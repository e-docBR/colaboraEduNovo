from sqlalchemy import select

from app.core.database import session_scope
from app.models import AcademicYear, Aluno, Nota, Tenant, Usuario
from app.services.ingestion import (
    ParsedAlunoRecord,
    ParsedNotaRecord,
    _build_matricula_header_map,
    _extract_student_meta,
    _mi_row_value,
    _normalize_turma_name,
    apply_records,
)


def _cleanup_matricula(matricula: str) -> None:
    with session_scope() as session:
        usuario = session.execute(select(Usuario).where(Usuario.username == "fulanotest-ingest")).scalar_one_or_none()
        if usuario:
            session.delete(usuario)
        aluno = session.execute(select(Aluno).where(Aluno.matricula == matricula)).scalar_one_or_none()
        if aluno:
            usuario = session.execute(select(Usuario).where(Usuario.aluno_id == aluno.id)).scalar_one_or_none()
            if usuario:
                session.delete(usuario)
            session.delete(aluno)
        session.commit()


def _ensure_test_year() -> tuple[int, int]:
    with session_scope() as session:
        tenant = session.query(Tenant).filter(Tenant.slug == "default").first()
        if not tenant:
            tenant = Tenant(name="Escola Teste", slug="default", is_active=True)
            session.add(tenant)
            session.flush()
        year = session.query(AcademicYear).filter(
            AcademicYear.tenant_id == tenant.id,
            AcademicYear.label == "2026",
        ).first()
        if not year:
            year = AcademicYear(tenant_id=tenant.id, label="2026", is_current=True)
            session.add(year)
            session.flush()
        return tenant.id, year.id


def test_apply_records_creates_and_updates_aluno_notas(flask_app):
    matricula = "TEST-INGEST"
    _cleanup_matricula(matricula)
    tenant_id, academic_year_id = _ensure_test_year()

    primeira_execucao = ParsedAlunoRecord(
        matricula=matricula,
        nome="Fulano da Silva",
        turma="6A",
        turno="MATUTINO",
        notas=[
            ParsedNotaRecord(
                disciplina="Matemática",
                disciplina_normalizada="matematica",
                trimestre1=8.5,
                trimestre2=9.0,
                trimestre3=8.0,
                total=25.5,
                faltas=2,
                situacao="APROVADO",
            )
        ],
    )

    assert apply_records(
        [primeira_execucao],
        tenant_id=tenant_id,
        academic_year_id=academic_year_id,
    ) == 1

    with session_scope() as session:
        aluno = session.execute(select(Aluno).where(Aluno.matricula == matricula)).scalar_one()
        assert aluno.nome == "Fulano da Silva"
        assert aluno.turma == "6A"
        assert aluno.turno == "MATUTINO"
        nota = session.execute(
            select(Nota).where(Nota.aluno_id == aluno.id, Nota.disciplina_normalizada == "matematica")
        ).scalar_one()
        assert float(nota.trimestre1) == 8.5
        assert nota.faltas == 2

    segunda_execucao = ParsedAlunoRecord(
        matricula=matricula,
        nome="Fulano Atualizado",
        turma="6B",
        turno="VESPERTINO",
        notas=[
            ParsedNotaRecord(
                disciplina="Matemática",
                disciplina_normalizada="matematica",
                trimestre1=9.5,
                trimestre2=9.0,
                trimestre3=9.2,
                total=27.7,
                faltas=1,
                situacao="APROVADO",
            )
        ],
    )

    assert apply_records(
        [segunda_execucao],
        tenant_id=tenant_id,
        academic_year_id=academic_year_id,
    ) == 1

    with session_scope() as session:
        aluno = session.execute(select(Aluno).where(Aluno.matricula == matricula)).scalar_one()
        assert aluno.nome == "Fulano Atualizado"
        assert aluno.turma == "6º B"
        assert aluno.turno == "VESPERTINO"
        nota = session.execute(
            select(Nota).where(Nota.aluno_id == aluno.id, Nota.disciplina_normalizada == "matematica")
        ).scalar_one()
        assert float(nota.trimestre1) == 9.5
        assert nota.faltas == 1

    _cleanup_matricula(matricula)


def test_extract_student_meta_from_pdf_text():
    text = (
        "BOLETIM ESCOLAR - 2025\n"
        "Aluno(a): ANA KELLY GOMES GONSALVES Matrícula: 47270\n"
        "Turma: 6º ANO A MATUTINO - - Ensino Fundamental de 9 anos - 6º Ano"
    )

    metas = _extract_student_meta(text)
    assert len(metas) == 1
    meta = metas[0]

    assert meta["nome"] == "ANA KELLY GOMES GONSALVES"
    assert meta["matricula"] == "47270"
    assert meta["turma"] == "6º A"
    assert meta["turno"] == "Matutino"


def test_extract_student_meta_handles_multiple_students_on_page():
    text = (
        "Aluno(a): ALUNO UM Matrícula: 10001\n"
        "Turma: 6º ANO A MATUTINO - - Ensino Fundamental\n"
        "Aluno(a): ALUNO DOIS Matrícula: 10002\n"
        "Turma: 6º ANO A MATUTINO - - Ensino Fundamental\n"
    )

    metas = _extract_student_meta(text)

    assert len(metas) == 2
    assert metas[0]["matricula"] == "10001"
    assert metas[1]["matricula"] == "10002"
    assert metas[0]["turma"] == "6º A"


def test_matricula_inicial_header_map_matches_sge_layout():
    table = [
        [
            "Nº",
            "Nome do aluno",
            "Sexo",
            "Data de Nasc.",
            "Naturalidade",
            "Zona",
            "Endereço",
            "Filiação",
            "Telefones:",
            "CPF",
            "NIS",
            "INEP",
            "Raça/cor",
            "Situação no ano anterior:",
        ],
        [
            "13",
            "ERICK SANTANA DA SILVA",
            "M",
            "16/07/2009",
            "MUCURI/BA",
            "Urbana",
            "RUA CARIBE 07 S/N - CARIBE 02",
            "Pai: JOSE CARLOS DA SILVA\nMãe: MARIA SANTANA ANDRADE DE OLIVEIRA",
            "(73) 999696365",
            "11027303510",
            "23676616983",
            "124364700303",
            "Parda",
            "Desistente",
        ],
    ]

    header = _build_matricula_header_map(table)
    row = table[1]

    assert _mi_row_value(row, header, "inep", fallback_index=11) == "124364700303"
    assert _mi_row_value(row, header, "situacao_anterior", fallback_index=13) == "Desistente"
    assert _mi_row_value(row, header, "situacao_anterior", fallback_index=12) != "Parda"


def test_normalize_turma_name_handles_eja_noturno_eixo_header():
    turma = _normalize_turma_name("EJA - EIXO V - 8º E 9º ANOS - TURMA G", "Noturno")

    assert turma == "8/9 G"


def test_normalize_turma_name_handles_eja_eixo_iv_turma_i_header():
    turma = _normalize_turma_name("EJA - EIXO IV - 6º E 7º ANOS - TURMA I", "Noturno")

    assert turma == "6/7 I"
