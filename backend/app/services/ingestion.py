"""PDF ingestion helpers used by the uploads endpoint."""
from __future__ import annotations

from dataclasses import dataclass, field
import re
from pathlib import Path
from typing import Iterable, Sequence
from unicodedata import normalize as u_normalize
from uuid import uuid4

import pdfplumber
from loguru import logger
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..core.database import session_scope
from ..models import Aluno, Nota, AcademicYear, Tenant
from .accounts import ensure_aluno_user


@dataclass(slots=True)
class ParsedNotaRecord:
    disciplina: str
    disciplina_normalizada: str
    trimestre1: float | None = None
    trimestre2: float | None = None
    trimestre3: float | None = None
    total: float | None = None
    faltas: int | None = None
    situacao: str | None = None


@dataclass(slots=True)
class ParsedAlunoRecord:
    matricula: str
    nome: str
    turma: str | None
    turno: str | None
    notas: list[ParsedNotaRecord] = field(default_factory=list)
    # Personal info
    sexo: str | None = None
    data_nascimento: str | None = None
    naturalidade: str | None = None
    zona: str | None = None
    endereco: str | None = None
    filiacao: str | None = None
    telefones: str | None = None
    cpf: str | None = None
    nis: str | None = None
    inep: str | None = None
    situacao_anterior: str | None = None


STUDENT_META_PATTERN = re.compile(
    r"Aluno(?:\(a\))?:\s*(?P<nome>.+?)\s+Matr[ií]cula:\s*(?P<matricula>\d+)",
    re.IGNORECASE | re.DOTALL,
)

BOLETIM_YEAR_PATTERN = re.compile(
    r"BOLETIM ESCOLAR\s*-\s*(?P<year>\d{4})",
    re.IGNORECASE
)

MI_HEADER_SIGNAL = "MATRÍCULA INICIAL"
MI_TURMA_PATTERN = re.compile(r"Série:\s*(?P<content>.+?)(?:\s+INEP|$)")
MI_TURNO_PATTERN = re.compile(r"Turno:\s*(?P<turno>\w+)")
MI_YEAR_PATTERN = re.compile(r"Ano:\s*(?P<year>\d{4})")


from ..core.queue import queue

def enqueue_pdf(filepath: Path, *, turno: str | None = None, turma: str | None = None, tenant_id: int | None = None, academic_year_id: int | None = None) -> str:
    job = queue.enqueue(
        process_pdf, 
        filepath, 
        turno=turno, 
        turma=turma, 
        tenant_id=tenant_id, 
        academic_year_id=academic_year_id,
        job_timeout=600
    )
    logger.info("Enqueued job {} for file {}", job.id, filepath.name)
    return job.id


def process_pdf(filepath: Path, *, turno: str | None = None, turma: str | None = None, tenant_id: int | None = None, academic_year_id: int | None = None) -> dict[str, any]:
    errors: list[str] = []
    records, extracted_year = parse_pdf(filepath, errors, turno=turno, turma=turma)
    
    final_year_label = "Desconhecido"

    # Resolve academic year: explicit parameter takes priority over PDF-extracted year.
    # The PDF year is only used as fallback when no academic_year_id is provided.
    if academic_year_id:
        with session_scope() as session:
            year_obj = session.get(AcademicYear, academic_year_id)
            if year_obj:
                final_year_label = year_obj.label
    elif extracted_year and tenant_id:
        with session_scope() as session:
            year_obj = session.query(AcademicYear).filter(
                AcademicYear.tenant_id == tenant_id,
                AcademicYear.label == str(extracted_year)
            ).first()
            if not year_obj:
                year_obj = AcademicYear(tenant_id=tenant_id, label=str(extracted_year), is_current=False)
                session.add(year_obj)
                session.flush()  # get ID without premature commit; session_scope commits on exit
                logger.info("Created new AcademicYear {} for tenant {}", extracted_year, tenant_id)
            academic_year_id = year_obj.id
            final_year_label = year_obj.label

    count = 0
    if not records:
        msg = f"Nenhum registro encontrado no boletim {filepath.name}. Verifique se o PDF contém 'Aluno(a): ... Matrícula: ...'"
        logger.warning(msg)
        errors.append(msg)
    else:
        count = apply_records(records, tenant_id=tenant_id, academic_year_id=academic_year_id)
    
    return {"count": count, "logs": errors, "year": final_year_label}


def apply_records(records: Sequence[ParsedAlunoRecord], tenant_id: int | None = None, academic_year_id: int | None = None) -> int:
    if not records:
        return 0
    from ..core.database import session_scope as _scope
    with _scope() as session:
        for record in records:
            aluno = _upsert_aluno(session, record, tenant_id=tenant_id, academic_year_id=academic_year_id)
            _upsert_notas(session, aluno, record.notas, tenant_id=tenant_id, academic_year_id=academic_year_id)
    return len(records)


def parse_pdf(filepath: Path, errors: list[str], *, turno: str | None = None, turma: str | None = None) -> tuple[list[ParsedAlunoRecord], int | None]:
    parsed: dict[str, ParsedAlunoRecord] = {}
    extracted_year = None
    
    with pdfplumber.open(str(filepath)) as pdf:
        first_page_text = (pdf.pages[0].extract_text() or "").upper()
        # Basic normalization: remove accents for matching
        norm_text = u_normalize("NFKD", first_page_text).encode("ascii", "ignore").decode("ascii")
        
        logger.debug("Processing {}", filepath.name)
        logger.debug("First page text len: {}", len(first_page_text))
        logger.debug("Norm text snippet: {}", norm_text[:200])

        # Check if it is a Matrícula Inicial/Final file
        is_mi = "MATRICULA INICIAL" in norm_text or "MATRICULA FINAL" in norm_text
        logger.debug("is_mi detected: {}", is_mi)
        
        if is_mi:
            logger.info("Detected Matrícula Inicial/Final format for {}", filepath.name)
            return _parse_matricula_inicial(pdf, errors, turno=turno, turma=turma)

        # Standard Bulletin format
        for page in pdf.pages:
            text = page.extract_text() or ""
            
            # Try to extract year once
            if extracted_year is None:
                year_match = BOLETIM_YEAR_PATTERN.search(text)
                if year_match:
                    extracted_year = int(year_match.group("year"))

            tables = page.extract_tables() or []
            student_metas = _extract_student_meta(text)
            if not student_metas:
                continue

            for idx, meta in enumerate(student_metas):
                matricula = meta.get("matricula")
                if not matricula:
                    errors.append(f"Página {page.page_number}: Aluno sem matrícula ignorado.")
                    continue

                registro = parsed.setdefault(
                    matricula,
                    ParsedAlunoRecord(
                        matricula=matricula,
                        nome=meta.get("nome") or "Aluno sem nome",
                        turma=meta.get("turma") or turma,
                        turno=meta.get("turno") or turno,
                    ),
                )
                if meta.get("nome"):
                    registro.nome = meta["nome"].strip()
                if meta.get("turma"):
                    registro.turma = meta["turma"]
                elif turma:
                    registro.turma = turma
                if meta.get("turno"):
                    registro.turno = meta["turno"]
                elif turno:
                    registro.turno = turno

                table_rows: Sequence[Sequence[Sequence[str | None]]] = []
                if idx < len(tables) and tables[idx]:
                    table_rows = [tables[idx]]

                for row in _extract_rows(table_rows):
                    disciplina = row.get("disciplina")
                    if not disciplina:
                        continue
                    registro.notas.append(
                        ParsedNotaRecord(
                            disciplina=disciplina.strip(),
                            disciplina_normalizada=_normalize_disciplina(disciplina),
                            trimestre1=_parse_float(row.get("trimestre1")),
                            trimestre2=_parse_float(row.get("trimestre2")),
                            trimestre3=_parse_float(row.get("trimestre3")),
                            total=_parse_float(row.get("total")),
                            faltas=_parse_int(row.get("faltas")),
                            situacao=_clean_text(row.get("situacao")),
                        )
                    )
    return list(parsed.values()), extracted_year


def _parse_matricula_inicial(pdf: pdfplumber.PDF, errors: list[str], *, turno: str | None = None, turma: str | None = None) -> tuple[list[ParsedAlunoRecord], int | None]:
    parsed_alunos: dict[str, ParsedAlunoRecord] = {}
    extracted_year = None
    
    file_turma = turma
    file_turno = turno

    for page in pdf.pages:
        text = page.extract_text() or ""
        
        # Extract Turma/Turno/Year if not already set (usually on first page)
        if extracted_year is None:
            year_match = MI_YEAR_PATTERN.search(text)
            if year_match:
                extracted_year = int(year_match.group("year"))
        
        if file_turma is None:
            tm = MI_TURMA_PATTERN.search(text)
            if tm:
                content = tm.group("content").strip()
                # Content might be "6º ANO A MATUTINO"
                t_name, t_turno = _split_turma_turno(content)
                file_turma = t_name
                if file_turno is None:
                    file_turno = t_turno

        if file_turno is None:
            tn = MI_TURNO_PATTERN.search(text)
            if tn:
                file_turno = tn.group("turno").capitalize()

        tables = page.extract_tables() or []
        for table in tables:
            if not table or len(table) < 2:
                continue
            
            for row in table:
                if not row or len(row) < 12:
                    continue
                
                idx_str = (row[0] or "").strip()
                if not idx_str.isdigit():
                    continue # Skip header rows
                
                nome = (row[1] or "").strip()
                if not nome or "NOME DO ALUNO" in nome.upper():
                    continue
                
                inep = (row[11] or "").strip()
                cpf = (row[9] or "").strip().replace(".", "").replace("-", "")
                matricula = inep if len(inep) >= 5 else (cpf if len(cpf) >= 5 else f"SEM-{_slugify(nome)[:10]}")
                
                if not matricula:
                    continue

                parsed_alunos[matricula] = ParsedAlunoRecord(
                    matricula=matricula,
                    nome=nome,
                    turma=file_turma,
                    turno=file_turno,
                    sexo=(row[2] or "").strip(),
                    data_nascimento=(row[3] or "").strip(),
                    naturalidade=(row[4] or "").strip(),
                    zona=(row[5] or "").strip(),
                    endereco=(row[6] or "").strip().replace("\n", " "),
                    filiacao=(row[7] or "").strip().replace("\n", " "),
                    telefones=(row[8] or "").strip(),
                    cpf=cpf,
                    nis=(row[10] or "").strip(),
                    inep=inep,
                    situacao_anterior=(row[12] or "").strip(),
                )
    
    return list(parsed_alunos.values()), extracted_year


def _extract_student_meta(text: str) -> list[dict[str, str | None]]:
    metas = _extract_student_meta_blocks(text)
    if metas:
        return metas
    fallback = _extract_single_student_meta(text)
    return [fallback] if fallback.get("matricula") else []


def _extract_student_meta_blocks(text: str) -> list[dict[str, str | None]]:
    if not text:
        return []
    matches = list(STUDENT_META_PATTERN.finditer(text))
    if not matches:
        return []
    metas: list[dict[str, str | None]] = []
    for idx, match in enumerate(matches):
        start = match.start()
        end = matches[idx + 1].start() if idx + 1 < len(matches) else len(text)
        block = text[start:end]
        turma_line = next((line for line in block.split("\n") if line.strip().lower().startswith("turma:")), "")
        turma_name = None
        turno_name = None
        if turma_line:
            turma_content = turma_line.split(":", 1)[1].strip()
            principal = turma_content.split("- -")[0].strip()
            turma_name, turno_name = _split_turma_turno(principal)
            turma_name = _normalize_turma_name(turma_name, turno_name)
        metas.append(
            {
                "nome": match.group("nome").strip(),
                "matricula": match.group("matricula").strip(),
                "turma": turma_name,
                "turno": turno_name,
            }
        )
    return metas


def _extract_single_student_meta(text: str) -> dict[str, str | None]:
    meta: dict[str, str | None] = {"matricula": None, "nome": None, "turma": None, "turno": None}
    if not text:
        return meta
    single_line = " ".join(text.split())
    aluno_match = STUDENT_META_PATTERN.search(single_line)
    if aluno_match:
        meta["nome"] = aluno_match.group("nome").strip()
        meta["matricula"] = aluno_match.group("matricula").strip()

    turma_line = next((line for line in text.split("\n") if line.strip().lower().startswith("turma:")), "")
    if turma_line:
        turma_content = turma_line.split(":", 1)[1].strip()
        principal = turma_content.split("- -")[0].strip()
        turma_name, turno_name = _split_turma_turno(principal)
        meta["turma"] = _normalize_turma_name(turma_name, turno_name)
        meta["turno"] = turno_name

    return meta


def _split_turma_turno(value: str) -> tuple[str | None, str | None]:
    if not value:
        return None, None
    tokens = value.split()
    if not tokens:
        return None, None
    turno_tokens = {"MATUTINO", "VESPERTINO", "NOTURNO", "INTEGRAL"}
    turno = None
    if tokens[-1].upper() in turno_tokens:
        turno = tokens[-1].capitalize()
        tokens = tokens[:-1]
    turma = " ".join(tokens).strip()
    return (turma or None, turno)


def _normalize_turma_name(name: str | None, turno: str | None = None) -> str | None:
    """Standardizes turma names.
    Standard: 'Xº Y' (e.g., '6º A')
    EJA (Noturno): 'X/Y Z' (e.g., '6/7 A', '8/9 B')
    """
    if not name:
        return name

    # 1. Basic cleaning
    name = " ".join(name.split()).upper()

    # 2. Handle "ANO(S)" / "SERIE"
    name = re.sub(r"\bANOS?\b\.?", "", name)
    name = re.sub(r"\bS[EÉ]RIE\b\.?", "", name)

    # 3. Handle numbers followed by letter directly (e.g., 6A -> 6º A)
    # Match digit(s) followed optionally by 'o' or 'º' or 'ª' then space or letter
    match = re.search(r"(?P<num>\d+)\s*(?P<ord>[º°ºªoa])?\s*(?P<letra>[A-Z])$", name)
    num, letra = None, None
    
    if match:
        num = match.group("num")
        letra = match.group("letra")
    else:
        # 4. Handle just number + letter (no ordinal) at the end if step 3 missed it
        match_simple = re.search(r"\b(?P<num>\d+)\s+(?P<letra>[A-Z])\b", name)
        if match_simple:
            num = match_simple.group("num")
            letra = match_simple.group("letra")

    if num and letra:
        # Check for EJA (Noturno)
        is_noturno = turno and "NOTURNO" in turno.upper()
        if is_noturno:
            if num in ["6", "7"]:
                return f"6/7 {letra}"
            if num in ["8", "9"]:
                return f"8/9 {letra}"
        
        return f"{num}º {letra}"

    # 5. Final fallback cleanup
    name = " ".join(name.split())
    # Ensure there is a º after the number if missing
    name = re.sub(r"(\d+)(?!\s*º)\s*", r"\1º ", name)
    
    return " ".join(name.split()).strip()


def _extract_rows(tables: Sequence[Sequence[Sequence[str | None]]]) -> Iterable[dict[str, str]]:
    for table in tables:
        if not table:
            continue
        header = [_normalize_header(cell) for cell in table[0]]
        for raw_row in table[1:]:
            row: dict[str, str] = {}
            for idx, cell in enumerate(raw_row):
                key = header[idx] if idx < len(header) else None
                if not key:
                    continue
                value = (cell or "").strip()
                if value:
                    row[key] = value
            if row:
                yield row





def _upsert_aluno(session: Session, record: ParsedAlunoRecord, tenant_id: int | None = None, academic_year_id: int | None = None) -> Aluno:
    # 1. Try by matricula first (Standard) — include academic_year_id to avoid merging cross-year records
    stmt = select(Aluno).where(
        Aluno.matricula == record.matricula,
        Aluno.tenant_id == tenant_id,
        Aluno.academic_year_id == academic_year_id,
    )
    aluno = session.execute(stmt).scalar_one_or_none()

    # 2. Try by Name as fallback (Prevents duplicates between MI and Bulletin if IDs differ)
    if aluno is None and record.nome:
        try:
            stmt = select(Aluno).where(
                Aluno.nome == record.nome,
                Aluno.tenant_id == tenant_id,
                Aluno.academic_year_id == academic_year_id,
            )
            aluno = session.execute(stmt).scalar_one_or_none()
        except Exception:
             # If multiple students have the same name, we can't safely link them. 
             # Treat as a new student to avoid merging incorrect records.
             logger.warning(f"Ambiguous student name '{record.nome}' found during ingestion for tenant {tenant_id}. Creating new record.")
             aluno = None

    if aluno is None:
        aluno = Aluno(
            matricula=record.matricula,
            nome=record.nome,
            turma=record.turma or "",
            turno=record.turno or "",
            tenant_id=tenant_id,
            academic_year_id=academic_year_id,
            sexo=record.sexo,
            data_nascimento=record.data_nascimento,
            naturalidade=record.naturalidade,
            zona=record.zona,
            endereco=record.endereco,
            filiacao=record.filiacao,
            telefones=record.telefones,
            cpf=record.cpf,
            nis=record.nis,
            inep=record.inep,
            situacao_anterior=record.situacao_anterior
        )
        session.add(aluno)
        session.flush()
        ensure_aluno_user(session, aluno)
        return aluno

    # Update existing
    aluno.nome = record.nome or aluno.nome
    aluno.academic_year_id = academic_year_id # Update to current processing year
    
    # Update personal info if provided
    if record.sexo: aluno.sexo = record.sexo
    if record.data_nascimento: aluno.data_nascimento = record.data_nascimento
    if record.naturalidade: aluno.naturalidade = record.naturalidade
    if record.zona: aluno.zona = record.zona
    if record.endereco: aluno.endereco = record.endereco
    if record.filiacao: aluno.filiacao = record.filiacao
    if record.telefones: aluno.telefones = record.telefones
    if record.cpf: aluno.cpf = record.cpf
    if record.nis: aluno.nis = record.nis
    if record.inep: aluno.inep = record.inep
    if record.situacao_anterior: aluno.situacao_anterior = record.situacao_anterior

    # Only update matricula if it was a placeholder SEM- and we now have a real one
    if aluno.matricula.startswith("SEM-") and not record.matricula.startswith("SEM-"):
        aluno.matricula = record.matricula

    if record.turma:
        aluno.turma = _normalize_turma_name(record.turma, record.turno)
    if record.turno:
        aluno.turno = record.turno
    
    ensure_aluno_user(session, aluno)
    return aluno


def _upsert_notas(session: Session, aluno: Aluno, notas: Sequence[ParsedNotaRecord], tenant_id: int | None = None, academic_year_id: int | None = None) -> None:
    for nota_data in notas:
        stmt = select(Nota).where(
            Nota.aluno_id == aluno.id,
            Nota.disciplina_normalizada == nota_data.disciplina_normalizada,
            Nota.tenant_id == tenant_id,
            Nota.academic_year_id == academic_year_id
        )
        existing = session.execute(stmt).scalars().all()
        nota = existing[0] if existing else None
        for duplicate in existing[1:]:
            session.delete(duplicate)
        if nota is None:
            nota = Nota(
                aluno_id=aluno.id,
                disciplina=nota_data.disciplina,
                disciplina_normalizada=nota_data.disciplina_normalizada,
                tenant_id=tenant_id,
                academic_year_id=academic_year_id
            )
            session.add(nota)
        else:
            nota.disciplina = nota_data.disciplina
        nota.trimestre1 = nota_data.trimestre1
        nota.trimestre2 = nota_data.trimestre2
        nota.trimestre3 = nota_data.trimestre3
        nota.total = nota_data.total
        nota.faltas = nota_data.faltas or 0
        nota.situacao = _normalize_situacao(nota_data.situacao)


# All situacao codes accepted by the DB check constraint.
_VALID_SITUACAO = frozenset({
    "APR", "REP", "REC", "APCC", "AR",
    "EMC", "EMR", "AFC", "DPC", "TRN", "ABA",
})

# Map long-form / alternate labels found in real PDFs to canonical codes.
_SITUACAO_ALIASES: dict[str, str] = {
    "APROVADO": "APR",
    "APROVADA": "APR",
    "REPROVADO": "REP",
    "REPROVADA": "REP",
    "RECUPERACAO": "REC",
    "RECUPERAÇÃO": "REC",
    "EM RECUPERACAO": "REC",
    "EM RECUPERAÇÃO": "REC",
    "APROVADO POR CONSELHO": "APCC",
    "APCC": "APCC",
    "EM CURSO": "EMC",
    "EMCURSO": "EMC",
    "EM REGIME": "EMR",
    "TRANSFERIDO": "TRN",
    "TRANSFERIDA": "TRN",
    "ABANDONO": "ABA",
}


def _normalize_situacao(value: str | None) -> str | None:
    """Map raw PDF situacao text to a canonical DB-accepted code.

    Returns None for unknown values to avoid CheckViolation crashes, logging
    a warning so admins can add new aliases when new codes appear.
    """
    if not value:
        return None
    upper = value.strip().upper()
    if upper in _VALID_SITUACAO:
        return upper
    alias = _SITUACAO_ALIASES.get(upper)
    if alias:
        return alias
    logger.warning("Situacao desconhecida '{}' encontrada no PDF — será ignorada. Adicione ao _SITUACAO_ALIASES se necessário.", value)
    return None


def _normalize_header(value: str | None) -> str | None:
    if not value:
        return None
    key = _slugify(value)
    aliases = {
        "matr": "matricula",
        "matricula": "matricula",
        "aluno": "nome",
        "alunoa": "nome",
        "estudante": "nome",
        "nome": "nome",
        "disciplina": "disciplina",
        "componentes-curriculares": "disciplina",
        "turma": "turma",
        "turno": "turno",
        "trimestre1": "trimestre1",
        "1-trimestre": "trimestre1",
        "1o-trimestre": "trimestre1",
        "primeiro-trimestre": "trimestre1",
        "trimestre2": "trimestre2",
        "2-trimestre": "trimestre2",
        "2o-trimestre": "trimestre2",
        "segundo-trimestre": "trimestre2",
        "trimestre3": "trimestre3",
        "3-trimestre": "trimestre3",
        "3o-trimestre": "trimestre3",
        "terceiro-trimestre": "trimestre3",
        "total": "total",
        "total-de-pontos": "total",
        "recuperacao": "recuperacao",
        "t-faltas": "faltas",
        "faltas": "faltas",
        "situacao": "situacao",
    }
    return aliases.get(key)


def _normalize_disciplina(value: str) -> str:
    return _slugify(value)


def _slugify(value: str) -> str:
    if not value:
        return ""
    normalized = u_normalize("NFKD", value)
    ascii_value = normalized.encode("ascii", "ignore").decode("ascii")
    # Remove "ANO" to match 7º ANO F with 7º F
    ascii_value = re.sub(r"\bano\b", "", ascii_value, flags=re.IGNORECASE)
    ascii_value = ascii_value.strip().lower()
    ascii_value = re.sub(r"[^a-z0-9]+", "-", ascii_value)
    return "-".join(filter(None, ascii_value.split("-")))


def _parse_float(value: str | None) -> float | None:
    if not value:
        return None
    value = value.replace("%", "").replace(",", ".")
    try:
        return float(value)
    except ValueError:
        return None


def _parse_int(value: str | None) -> int | None:
    if not value:
        return None
    digits = re.sub(r"[^0-9-]", "", value)
    if not digits:
        return None
    try:
        return int(digits)
    except ValueError:
        return None


def _clean_text(value: str | None) -> str | None:
    if not value:
        return None
    text = value.strip()
    return text or None
