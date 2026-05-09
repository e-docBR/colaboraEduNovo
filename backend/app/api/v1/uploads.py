"""Uploads endpoints for boletim PDFs."""
from pathlib import Path
import re

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required
from werkzeug.utils import secure_filename

from ...core.config import settings
from ...core.decorators import require_roles
from ...core.extensions import limiter
from ...services import enqueue_pdf

_PDF_MAGIC = b"%PDF-"
_MAX_EXTENSION = ".pdf"


def _is_valid_pdf(file_stream) -> bool:
    """Verifica se o arquivo contém o magic bytes de PDF nos primeiros 1024 bytes.
    Busca dentro de 1024 bytes para aceitar PDFs com BOM UTF-8 ou whitespace antes do header.
    """
    header = file_stream.read(1024)
    file_stream.seek(0)
    return _PDF_MAGIC in header


def register(parent: Blueprint) -> None:
    bp = Blueprint("uploads", __name__)

    @bp.post("/uploads/pdf")
    @jwt_required()
    @limiter.limit("20 per hour")
    @require_roles("admin", "super_admin")
    def upload_boletim():
        if "file" not in request.files:
            return jsonify({"error": "arquivo não enviado"}), 400

        turno = (request.form.get("turno") or "").strip()
        turma = (request.form.get("turma") or "").strip()
        if not turno or not turma:
            return jsonify({"error": "turno e turma são obrigatórios"}), 400
        if len(turno) > 60 or len(turma) > 60:
            return jsonify({"error": "turno e turma devem ter no máximo 60 caracteres"}), 400

        file = request.files["file"]
        filename = secure_filename(file.filename)
        if not filename:
            return jsonify({"error": "nome de arquivo inválido"}), 400

        # Valida extensão
        if not filename.lower().endswith(_MAX_EXTENSION):
            return jsonify({"error": "apenas arquivos PDF são permitidos"}), 400

        # Valida magic bytes (evita renomear outros tipos para .pdf)
        if not _is_valid_pdf(file.stream):
            return jsonify({"error": "arquivo inválido: não é um PDF"}), 400

        # Valida tamanho: lê até MAX+1 bytes para detectar excesso sem ler tudo
        max_bytes = settings.max_upload_size_mb * 1024 * 1024
        file.stream.seek(0, 2)  # seek to end
        file_size = file.stream.tell()
        file.stream.seek(0)
        if file_size > max_bytes:
            return jsonify({"error": f"arquivo muito grande (máximo {settings.max_upload_size_mb} MB)"}), 413

        base_upload = Path(settings.upload_folder).resolve()
        upload_dir = (base_upload / _normalize_segment(turno) / _normalize_segment(turma)).resolve()
        filepath = (upload_dir / filename).resolve()

        # C5: validate paths BEFORE creating any directories
        base_str = str(base_upload)
        if not str(upload_dir).startswith(base_str + "/") and str(upload_dir) != base_str:
            return jsonify({"error": "caminho de arquivo inválido"}), 400
        if not str(filepath).startswith(base_str + "/"):
            return jsonify({"error": "caminho de arquivo inválido"}), 400

        upload_dir.mkdir(parents=True, exist_ok=True)

        file.save(filepath)

        from flask import g
        job_id = enqueue_pdf(
            filepath, 
            turno=turno, 
            turma=turma, 
            tenant_id=g.tenant_id, 
            academic_year_id=g.academic_year_id
        )
        return (
            jsonify(
                {
                    "filename": filename,
                    "status": "queued",
                    "job_id": job_id,
                    "turno": turno,
                    "turma": turma,
                }
            ),
            202,
        )

    @bp.post("/uploads/csv/alunos")
    @jwt_required()
    @limiter.limit("10 per hour")
    @require_roles("admin", "super_admin")
    def upload_alunos_csv():
        """Accept a CSV file and enqueue bulk student import as an RQ job."""
        from flask import g
        from ...services.csv_import import parse_csv_bytes, run_csv_import
        from ...core.queue import queue

        if "file" not in request.files:
            return jsonify({"error": "arquivo não enviado"}), 400

        file = request.files["file"]
        filename = secure_filename(file.filename or "")
        if not filename.lower().endswith(".csv"):
            return jsonify({"error": "apenas arquivos CSV são permitidos"}), 400

        raw = file.read(2 * 1024 * 1024)  # cap at 2 MB
        if len(raw) >= 2 * 1024 * 1024:
            return jsonify({"error": "arquivo muito grande (máximo 2 MB)"}), 413

        rows, parse_errors = parse_csv_bytes(raw)

        if parse_errors and not rows:
            # Fatal parsing error (missing columns etc.)
            return jsonify({
                "error": parse_errors[0].message,
                "details": [{"row": e.row, "field": e.field, "message": e.message} for e in parse_errors]
            }), 422

        if not rows:
            return jsonify({"error": "Nenhuma linha válida encontrada no CSV"}), 422

        tenant_id = g.tenant_id
        academic_year_id = getattr(g, "academic_year_id", None)
        user_id = int(request.environ.get("JWT_IDENTITY") or 0)
        from flask_jwt_extended import get_jwt_identity
        user_id = int(get_jwt_identity())

        job = queue.enqueue(
            run_csv_import,
            rows,
            tenant_id,
            academic_year_id,
            user_id,
            job_timeout=300,
            meta={"tenant_id": tenant_id, "filename": filename, "row_count": len(rows)},
        )

        return jsonify({
            "status": "queued",
            "job_id": job.id,
            "rows_queued": len(rows),
            "parse_errors": [{"row": e.row, "field": e.field, "message": e.message} for e in parse_errors],
        }), 202

    @bp.get("/uploads/jobs/<job_id>")
    @jwt_required()
    def get_job_status(job_id):
        from rq.job import Job, NoSuchJobError
        from flask import g
        from ...core.queue import redis_conn

        try:
            job = Job.fetch(job_id, connection=redis_conn)
        except NoSuchJobError:
            return jsonify({"error": "Job não encontrado"}), 404

        job_tenant_id = job.meta.get("tenant_id")
        if job_tenant_id is None or int(job_tenant_id) != int(g.tenant_id):
            return jsonify({"error": "Job não encontrado"}), 404

        return jsonify({
            "job_id": job.id,
            "status": job.get_status(),
            "result": job.result if job.is_finished else None,
            "enqueued_at": job.enqueued_at.isoformat() if job.enqueued_at else None,
            "started_at": job.started_at.isoformat() if job.started_at else None,
            "ended_at": job.ended_at.isoformat() if job.ended_at else None,
            "meta": job.meta,
        })

    parent.register_blueprint(bp)


def _normalize_segment(value: str) -> str:
    slug = re.sub(r"[^0-9A-Za-z_-]+", "-", value.strip())
    return slug or "geral"
