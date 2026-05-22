# Backend — Plataforma Boletins Frei

## Visão Geral
API Flask multi-tenant para autenticação, gestão acadêmica, relatórios, ingestão e integrações operacionais.

## Setup
O workspace usa a virtualenv da raiz do repositório.

```bash
cd /home/suporte/colaboraEduNovo
python3 -m venv .venv
./.venv/bin/pip install -e "backend[dev]"
```

## Execução local
```bash
make backend
make worker
```

## Autenticação
- Web: `access_token` no body e `refresh_token` em cookie HttpOnly `rt`.
- Mobile: `X-Client-Platform: mobile`, com `refresh_token` no body e refresh por `Authorization: Bearer <refresh_token>`.
- `POST /api/v1/auth/logout` revoga access token e refresh token.

## Validação
```bash
make doctor
make validate-backend
```

Para testes focados de autenticação/health sem o gate global de cobertura:

```bash
./.venv/bin/python -m pytest --no-cov backend/tests/test_auth.py backend/tests/test_health.py
```

## Estrutura
```text
app/
  core/        # config, db, segurança
  api/         # blueprints organizados por domínio
  services/    # regras de negócio
  models/      # SQLAlchemy ORM
  schemas/     # contratos e serialização
```
