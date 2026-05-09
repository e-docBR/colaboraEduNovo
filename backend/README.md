# Backend — Plataforma Boletins Frei

## Visão Geral
API Flask modular que expõe serviços acadêmicos (alunos, turmas, notas, relatórios, ingestão) mantendo compatibilidade com o pipeline atual de pdfplumber e SQLite. Esta pasta contém apenas a nova camada REST; a lógica de extração permanece em `importar_boletins.py`.

## Requisitos
- Python 3.12+
- pip / uv / Poetry (qualquer gerenciador que leia `pyproject.toml`)
- SQLite 3.45+ (modo WAL habilitado)

## Setup Rápido
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -e .[dev]
cp .env.example .env
# Inicializar banco de dados e migrações
alembic upgrade head
flask --app app run --debug
```

## Funcionalidades
- **Autenticação**: Login JWT, refresh token, alteração de senha.
- **Usuários**: Upload de foto de perfil, gestão de usuários.
- **Acadêmico**: Alunos, Turmas, Notas, Relatórios.
- **Ingestão**: Upload de boletins PDF.

## Estrutura
```
app/
  core/        # config, db, segurança
  api/         # blueprints organizados por domínio
  services/    # regras de negócio (analytics, ingestão)
  models/      # SQLAlchemy ORM
  schemas/     # validação e serialização
```

## Próximos Passos
- Preencher os endpoints (ver `docs/api-contract.md`).
- Acrescentar testes de integração com banco em memória.
- Conectar ao pipeline real de ingestão assim que disponível.
