"""Endpoints para gerenciamento de configurações da escola (Tenant).

Acesso restrito a administradores e super-administradores.
"""
from __future__ import annotations

import os
import uuid
from pathlib import Path
from flask import Blueprint, jsonify, request, send_from_directory, current_app, g
from flask_jwt_extended import jwt_required

from ...core.config import settings
from ...core.database import session_scope
from ...core.decorators import require_roles
from ...models import Tenant
from ...schemas.escola import EscolaDetailResponse, EscolaUpdatePayload


def register(parent: Blueprint) -> None:
    bp = Blueprint("escola", __name__)

    @bp.get("/escola")
    @jwt_required()
    @require_roles("admin", "super_admin")
    def get_escola():
        tenant_id = g.tenant_id
        with session_scope() as session:
            tenant = session.get(Tenant, tenant_id)
            if not tenant:
                return jsonify({"error": "Escola não encontrada"}), 404

            # Ensure settings is populated
            current_settings = tenant.settings or {}
            
            return jsonify({
                "name": tenant.name,
                "slug": tenant.slug,
                "settings": {
                    "cnpj": current_settings.get("cnpj"),
                    "endereco": current_settings.get("endereco"),
                    "telefone": current_settings.get("telefone"),
                    "email": current_settings.get("email"),
                    "media_aprovacao": float(current_settings.get("media_aprovacao", 50.0)),
                    "logo_url": current_settings.get("logo_url"),
                    "whatsapp_enabled": bool(current_settings.get("whatsapp_enabled", False)),
                    "email_enabled": bool(current_settings.get("email_enabled", False)),
                    "whatsapp_instance_url": current_settings.get("whatsapp_instance_url"),
                    "whatsapp_instance_token": current_settings.get("whatsapp_instance_token"),
                }
            })

    @bp.put("/escola")
    @jwt_required()
    @require_roles("admin", "super_admin")
    def update_escola():
        tenant_id = g.tenant_id
        payload = request.get_json() or {}

        # Validate with pydantic
        try:
            validated = EscolaUpdatePayload.model_validate(payload)
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400

        with session_scope() as session:
            tenant = session.get(Tenant, tenant_id)
            if not tenant:
                return jsonify({"error": "Escola não encontrada"}), 404

            tenant.name = validated.name
            
            # Update settings JSON dict
            tenant.settings = validated.settings.model_dump()
            session.add(tenant)
            session.flush()

            return jsonify({
                "message": "Configurações da escola salvas com sucesso.",
                "name": tenant.name,
                "settings": tenant.settings
            })

    @bp.post("/escola/logo")
    @jwt_required()
    @require_roles("admin", "super_admin")
    def upload_logo():
        if "file" not in request.files:
            return jsonify({"error": "Arquivo não enviado"}), 400
            
        file = request.files["file"]
        if not file.filename:
            return jsonify({"error": "Nome de arquivo inválido"}), 400

        # Enforce file size limit (5 MB)
        MAX_LOGO_BYTES = 5 * 1024 * 1024
        file.seek(0, 2)
        file_size = file.tell()
        file.seek(0)
        if file_size > MAX_LOGO_BYTES:
            return jsonify({"error": "Arquivo muito grande. Máximo permitido: 5 MB"}), 413

        ALLOWED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp'}
        ALLOWED_MIMES = {'image/jpeg', 'image/png', 'image/webp'}

        ext = Path(file.filename).suffix.lower()
        if ext not in ALLOWED_EXTENSIONS or file.mimetype not in ALLOWED_MIMES:
            return jsonify({"error": "Tipo de arquivo não permitido"}), 400

        # Verify magic bytes
        header = file.read(16)
        file.seek(0)
        is_jpeg = header.startswith(b'\xff\xd8')
        is_png = header.startswith(b'\x89PNG')
        is_webp = header.startswith(b'RIFF') and header[8:12] == b'WEBP'
        if not (is_jpeg or is_png or is_webp):
            return jsonify({"error": "Arquivo de imagem inválido"}), 400

        tenant_id = g.tenant_id
        safe_ext = ext if ext in ALLOWED_EXTENSIONS else '.png'
        filename = f"logo_{tenant_id}_{uuid.uuid4().hex}{safe_ext}"

        logos_dir = Path(settings.upload_folder) / "logos"
        logos_dir.mkdir(parents=True, exist_ok=True)

        filepath = logos_dir / filename
        file.save(filepath)

        logo_url = f"/api/v1/static/logos/{filename}"

        # Update in database settings JSON
        with session_scope() as session:
            tenant = session.get(Tenant, tenant_id)
            if tenant:
                settings_dict = dict(tenant.settings or {})
                old_url = settings_dict.get("logo_url")
                settings_dict["logo_url"] = logo_url
                tenant.settings = settings_dict
                session.add(tenant)
                session.flush()

                # Clean up old file to save space
                if old_url:
                    old_filename = old_url.rsplit("/", 1)[-1]
                    old_path = (logos_dir / old_filename).resolve()
                    if old_path.is_relative_to(logos_dir.resolve()):
                        try:
                            old_path.unlink(missing_ok=True)
                        except OSError:
                            pass

        return jsonify({"logo_url": logo_url})

    @bp.route("/static/logos/<path:filename>")
    def serve_logo(filename):
        logos_dir = os.path.abspath(os.path.join(settings.upload_folder, "logos"))
        return send_from_directory(logos_dir, filename)

    parent.register_blueprint(bp)
