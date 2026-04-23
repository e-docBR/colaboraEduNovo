"""Versioned API blueprint."""
from flask import Blueprint, request

from . import alunos, auth, dashboard, graficos, notas, relatorios, turmas, uploads, usuarios, comunicados, ocorrencias, audit, chat, academic_years, super_admin, ai

api_v1_bp = Blueprint("api_v1", __name__)

@api_v1_bp.before_request
def before_v1_request():
    from app.core.middleware import resolve_tenant_context
    # Bypass for super_admin routes, auth/login and public tenants
    PUBLIC_ENDPOINTS = {
        "api_v1.auth.login",
        "api_v1.auth.list_public_tenants",
        "api_v1.auth.forgot_password",
        "api_v1.auth.reset_password",
        "api_v1.usuarios.serve_photo",
    }
    if request.blueprint == "api_v1.super_admin" or request.endpoint in PUBLIC_ENDPOINTS:
        return None
    return resolve_tenant_context()

alunos.register(api_v1_bp)
auth.register(api_v1_bp)
dashboard.register(api_v1_bp)
graficos.register(api_v1_bp)
notas.register(api_v1_bp)
relatorios.register(api_v1_bp)
turmas.register(api_v1_bp)
uploads.register(api_v1_bp)
usuarios.register(api_v1_bp)
comunicados.register(api_v1_bp)
ocorrencias.register(api_v1_bp)
audit.register(api_v1_bp)
chat.register(api_v1_bp)
academic_years.register(api_v1_bp)
super_admin.register(api_v1_bp)
ai.register(api_v1_bp)
