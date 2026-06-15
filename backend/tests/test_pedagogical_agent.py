import json
from unittest.mock import patch
from app.models.aluno import Aluno
from app.models.nota import Nota
from app.models.ocorrencia import Ocorrencia
from app.models.ai_configuration import AIConfiguration
from app.services.pedagogical_agent_service import pedagogical_agent_service
from app.core.database import session_scope


def test_get_student_context(session, admin_user):
    # Merge admin_user to avoid DetachedInstanceError
    user = session.merge(admin_user)
    tenant_id = user.tenant_id

    # Setup aluno
    aluno = Aluno(
        matricula="AL123",
        nome="Abner Teste",
        turma="8A",
        turno="MATUTINO",
        tenant_id=tenant_id,
        academic_year_id=1,  # matches default setup
    )
    session.add(aluno)
    session.flush()

    # Notas
    nota1 = Nota(
        aluno_id=aluno.id,
        disciplina="MATEMATICA",
        disciplina_normalizada="matematica",
        total=55.0,
        faltas=5,
        tenant_id=tenant_id,
        academic_year_id=1,
    )
    nota2 = Nota(
        aluno_id=aluno.id,
        disciplina="PORTUGUES",
        disciplina_normalizada="portugues",
        total=70.0,
        faltas=2,
        tenant_id=tenant_id,
        academic_year_id=1,
    )
    session.add_all([nota1, nota2])

    # Ocorrencia
    oc = Ocorrencia(
        aluno_id=aluno.id,
        tipo="Falta Disciplinar",
        descricao="Conversa excessiva",
        gravidade="LEVE",
        tenant_id=tenant_id,
        academic_year_id=1,
    )
    session.add(oc)
    session.commit()

    context = pedagogical_agent_service.get_student_context(
        session, tenant_id, 1, aluno.id
    )

    assert context["aluno_nome"] == "Abner Teste"
    assert context["total_faltas"] == 7
    assert len(context["notas"]) == 2
    assert len(context["ocorrencias"]) == 1
    assert context["ocorrencias"][0]["tipo"] == "Falta Disciplinar"


@patch("app.services.pedagogical_agent_service.call_llm")
def test_generate_plan_success(mock_call_llm, session, admin_user):
    user = session.merge(admin_user)
    tenant_id = user.tenant_id

    # Setup AI config
    ai_config = AIConfiguration(
        tenant_id=tenant_id,
        is_active=True,
        provider="openai",
        model_name="gpt-4o-mini",
        api_key="enc:dummy_key",
        system_prompt="Regras da escola",
    )
    session.add(ai_config)

    aluno = Aluno(
        matricula="AL124",
        nome="Lucas",
        turma="8A",
        turno="MATUTINO",
        tenant_id=tenant_id,
        academic_year_id=1,
    )
    session.add(aluno)
    session.commit()

    # Mock response da IA
    mock_response = {
        "global_risk": "ALTO",
        "diagnostico": "O aluno está com sérias dificuldades.",
        "metas": ["Atingir média em Matemática"],
        "acoes": [
            {
                "title": "Apoio Pedagógico",
                "description": "Indicar reforço escolar.",
                "priority": "HIGH",
                "type": "ACADEMIC",
            }
        ],
    }
    mock_call_llm.return_value = json.dumps(mock_response)

    res = pedagogical_agent_service.generate_plan(
        session, tenant_id, 1, aluno.id
    )

    assert "error" not in res
    assert res["global_risk"] == "ALTO"
    assert res["diagnostico"] == "O aluno está com sérias dificuldades."
    assert len(res["acoes"]) == 1
    assert res["acoes"][0]["title"] == "Apoio Pedagógico"


def test_api_generate_and_feedback_flow(client, auth_headers, flask_app, admin_user):
    with session_scope() as session:
        user = session.merge(admin_user)
        tenant_id = user.tenant_id

        # Setup AI config
        ai_config = AIConfiguration(
            tenant_id=tenant_id,
            is_active=True,
            provider="openai",
            model_name="gpt-4o-mini",
            api_key="enc:dummy_key",
        )
        session.add(ai_config)

        aluno = Aluno(
            matricula="AL125",
            nome="Gabriela",
            turma="8A",
            turno="MATUTINO",
            tenant_id=tenant_id,
            academic_year_id=1,
        )
        session.add(aluno)
        session.flush()
        aluno_id = aluno.id
        session.commit()

    # Mock da chamada LLM na API
    mock_response = {
        "global_risk": "MEDIO",
        "diagnostico": "Gabriela apresenta queda pontual nas notas.",
        "metas": ["Focar em humanas"],
        "acoes": [
            {
                "title": "Ação Humanas",
                "description": "Leitura extra.",
                "priority": "MEDIUM",
                "type": "ACADEMIC",
            }
        ],
    }

    with patch("app.services.pedagogical_agent_service.call_llm") as mock_call_llm:
        mock_call_llm.return_value = json.dumps(mock_response)

        # 1. Rota de geração do plano
        response = client.post(
            "/api/v1/ai/interventions/generate",
            json={"aluno_id": aluno_id},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json
        assert data["status"] == "PENDENTE"
        assert data["diagnostico"] == "Gabriela apresenta queda pontual nas notas."
        plan_id = data["id"]

        # 2. Rota de salvamento do feedback (Com edição)
        edited_actions = [
            {
                "title": "Ação Humanas",
                "description": "Leitura extra de livros de História.",
                "priority": "HIGH",
                "type": "ACADEMIC",
            }
        ]
        response_fb = client.post(
            "/api/v1/ai/interventions/save-feedback",
            json={
                "id": plan_id,
                "status": "APROVADO",
                "feedback_usuario": "Boa sugestão, adicionei especificidade.",
                "acoes_finais": edited_actions,
            },
            headers=auth_headers,
        )
        assert response_fb.status_code == 200
        fb_data = response_fb.json
        assert fb_data["status"] == "APROVADO"
        assert fb_data["edited"] is True
        assert fb_data["acoes_finais"][0]["priority"] == "HIGH"

        # 3. Rota de histórico de intervenções
        response_hist = client.get(
            f"/api/v1/ai/interventions/history/{aluno_id}", headers=auth_headers
        )
        assert response_hist.status_code == 200
        hist_data = response_hist.json
        assert len(hist_data) == 1
        assert hist_data[0]["status"] == "APROVADO"
