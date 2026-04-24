"""Bulk export endpoints — CSV and Excel download for grades and students."""
import csv
import io
from datetime import datetime

from flask import Blueprint, Response, jsonify, request, g
from flask_jwt_extended import jwt_required
from sqlalchemy.orm import joinedload

from ...core.database import session_scope
from ...core.decorators import require_roles
from ...models import Aluno, Nota


def _safe(value) -> str:
    """Convert any value to a safe string for CSV/Excel cells."""
    if value is None:
        return ""
    return str(value)


def _float_or_empty(value) -> str:
    if value is None:
        return ""
    try:
        return f"{float(value):.1f}"
    except (TypeError, ValueError):
        return ""


def register(parent: Blueprint) -> None:
    bp = Blueprint("exports", __name__)

    # ── Students export ──────────────────────────────────────────────────────

    @bp.get("/exports/alunos")
    @jwt_required()
    @require_roles("admin", "super_admin", "coordenador", "diretor", "orientador", "professor")
    def export_alunos():
        """Download the full student list with grade averages.

        Query params:
            format  csv | xlsx   (default: csv)
            turma   filter by class name
            turno   filter by shift
        """
        fmt = (request.args.get("format") or "csv").lower()
        turma_filter = (request.args.get("turma") or "").strip() or None
        turno_filter = (request.args.get("turno") or "").strip() or None

        if fmt not in ("csv", "xlsx"):
            return jsonify({"error": "Formato inválido. Use 'csv' ou 'xlsx'."}), 400

        with session_scope() as session:
            query = (
                session.query(Aluno)
                .options(joinedload(Aluno.notas))
                .filter(Aluno.tenant_id == g.tenant_id)
            )
            if getattr(g, "academic_year_id", None):
                query = query.filter(Aluno.academic_year_id == g.academic_year_id)
            if turma_filter:
                query = query.filter(Aluno.turma == turma_filter)
            if turno_filter:
                query = query.filter(Aluno.turno == turno_filter)

            alunos = query.order_by(Aluno.turma, Aluno.nome).all()

            rows = []
            for a in alunos:
                notas_vals = [float(n.total) for n in a.notas if n.total is not None]
                media = round(sum(notas_vals) / len(notas_vals), 1) if notas_vals else None
                total_faltas = sum(n.faltas or 0 for n in a.notas)
                rows.append({
                    "Matrícula": _safe(a.matricula),
                    "Nome": _safe(a.nome),
                    "Turma": _safe(a.turma),
                    "Turno": _safe(a.turno),
                    "Status": _safe(a.status) or "Ativo",
                    "Média Geral": _float_or_empty(media),
                    "Total de Faltas": _safe(total_faltas),
                })

        timestamp = datetime.now().strftime("%Y%m%d_%H%M")
        filename = f"alunos_{timestamp}"

        if fmt == "csv":
            return _csv_response(rows, filename)
        return _xlsx_response(rows, "Alunos", filename)

    # ── Grades export ─────────────────────────────────────────────────────────

    @bp.get("/exports/notas")
    @jwt_required()
    @require_roles("admin", "super_admin", "coordenador", "diretor", "orientador", "professor")
    def export_notas():
        """Download the complete grades table.

        Query params:
            format      csv | xlsx          (default: csv)
            turma       filter by class
            turno       filter by shift
            disciplina  filter by subject
        """
        fmt = (request.args.get("format") or "csv").lower()
        turma_filter = (request.args.get("turma") or "").strip() or None
        turno_filter = (request.args.get("turno") or "").strip() or None
        disciplina_filter = (request.args.get("disciplina") or "").strip() or None

        if fmt not in ("csv", "xlsx"):
            return jsonify({"error": "Formato inválido. Use 'csv' ou 'xlsx'."}), 400

        with session_scope() as session:
            query = (
                session.query(Nota)
                .options(joinedload(Nota.aluno))
                .filter(Nota.tenant_id == g.tenant_id)
            )
            if getattr(g, "academic_year_id", None):
                query = query.filter(Nota.academic_year_id == g.academic_year_id)
            if disciplina_filter:
                query = query.filter(Nota.disciplina == disciplina_filter)
            if turma_filter or turno_filter:
                query = query.join(Aluno)
                if turma_filter:
                    query = query.filter(Aluno.turma == turma_filter)
                if turno_filter:
                    query = query.filter(Aluno.turno == turno_filter)

            notas = (
                query.order_by(Aluno.turma, Aluno.nome, Nota.disciplina).all()
                if (turma_filter or turno_filter)
                else query.order_by(Nota.disciplina).all()
            )

            rows = []
            for n in notas:
                aluno = n.aluno
                rows.append({
                    "Matrícula": _safe(aluno.matricula if aluno else ""),
                    "Aluno": _safe(aluno.nome if aluno else ""),
                    "Turma": _safe(aluno.turma if aluno else ""),
                    "Turno": _safe(aluno.turno if aluno else ""),
                    "Disciplina": _safe(n.disciplina),
                    "1º Trimestre": _float_or_empty(n.trimestre1),
                    "2º Trimestre": _float_or_empty(n.trimestre2),
                    "3º Trimestre": _float_or_empty(n.trimestre3),
                    "Média Final": _float_or_empty(n.total),
                    "Faltas": _safe(n.faltas),
                    "Situação": _safe(n.situacao),
                })

        timestamp = datetime.now().strftime("%Y%m%d_%H%M")
        filename = f"notas_{timestamp}"

        if fmt == "csv":
            return _csv_response(rows, filename)
        return _xlsx_response(rows, "Notas", filename)

    parent.register_blueprint(bp)


# ── Helpers ────────────────────────────────────────────────────────────────────

def _csv_response(rows: list[dict], filename: str) -> Response:
    if not rows:
        rows = [{}]
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=list(rows[0].keys()), lineterminator="\r\n")
    writer.writeheader()
    writer.writerows(rows)
    output.seek(0)
    return Response(
        output.getvalue().encode("utf-8-sig"),  # BOM so Excel opens correctly
        mimetype="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}.csv"'},
    )


def _xlsx_response(rows: list[dict], sheet_name: str, filename: str) -> Response:
    import openpyxl
    from openpyxl.styles import Font, PatternFill, Alignment
    from openpyxl.utils import get_column_letter

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = sheet_name[:31]  # Excel tab name limit

    if not rows:
        rows = [{}]

    headers = list(rows[0].keys())

    # Header row styling
    header_fill = PatternFill("solid", fgColor="1E40AF")
    header_font = Font(bold=True, color="FFFFFF")

    for col_idx, header in enumerate(headers, start=1):
        cell = ws.cell(row=1, column=col_idx, value=header)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center")

    # Data rows
    for row_idx, row in enumerate(rows, start=2):
        for col_idx, header in enumerate(headers, start=1):
            ws.cell(row=row_idx, column=col_idx, value=row.get(header, ""))

    # Auto-fit column widths
    for col_idx, header in enumerate(headers, start=1):
        col_letter = get_column_letter(col_idx)
        max_len = max(
            len(header),
            *(len(str(r.get(header, "") or "")) for r in rows),
        )
        ws.column_dimensions[col_letter].width = min(max_len + 4, 50)

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)

    return Response(
        buf.getvalue(),
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}.xlsx"'},
    )
