from app.core.database import session_scope
from app.models import AcademicYear, Aluno, Nota, Tenant


def test_list_alunos_allows_large_page_for_selection_lists(client, auth_headers):
    with session_scope() as session:
        tenant = session.query(Tenant).filter(Tenant.slug == "default").one()
        year = (
            session.query(AcademicYear)
            .filter(AcademicYear.tenant_id == tenant.id, AcademicYear.is_current.is_(True))
            .one()
        )
        for idx in range(120):
            aluno = Aluno(
                matricula=f"SEL-{idx:03d}",
                nome=f"Aluno Selecao {idx:03d}",
                turma="6º A",
                turno="Matutino",
                tenant_id=tenant.id,
                academic_year_id=year.id,
            )
            session.add(aluno)
            session.flush()
            session.add(
                Nota(
                    aluno_id=aluno.id,
                    disciplina="Matematica",
                    disciplina_normalizada="matematica",
                    total=80,
                    faltas=0,
                    situacao="APR",
                    tenant_id=tenant.id,
                    academic_year_id=year.id,
                )
            )

    response = client.get("/api/v1/alunos?per_page=1000", headers=auth_headers)

    assert response.status_code == 200
    assert response.json["meta"]["per_page"] == 1000
    assert response.json["meta"]["total"] >= 120
    assert len(response.json["items"]) >= 120
