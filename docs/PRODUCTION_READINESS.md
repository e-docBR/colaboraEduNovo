# Production Readiness

## Estado atual

O projeto está em estado de `staging forte / piloto controlado`.

O baseline técnico está funcional:
- backend validado com `ruff` limpo e `19` testes de `auth` + `health`;
- frontend com `eslint`, `tsc` e `vite build`;
- mobile com `tsc --noEmit`;
- compose de produção com Traefik, PostgreSQL, Redis, worker RQ e backup diário.

Os principais gaps operacionais identificados na auditoria foram parcialmente fechados neste ciclo:
- o preflight de produção agora exige `APP_DB_USER`, `APP_DB_PASSWORD` e `FRONTEND_URL`;
- o CI usa `VITE_API_BASE_URL`, que é a variável realmente consumida pelo frontend;
- o workflow de deploy usa `--scale worker=3`, compatível com `docker compose`;
- o smoke test de deploy valida frontend, `/health` e descoberta de tenants.

## Modelo real de deploy

O ambiente usa `docker compose`, não Docker Swarm.

Consequências práticas:
- `deploy.replicas` e `deploy.resources` em `docker-compose.prod.yml` não são a fonte efetiva de escala quando o deploy roda com `docker compose up`;
- a escala real dos workers precisa ser aplicada explicitamente com `--scale worker=3`;
- limites de CPU e memória declarados em `deploy.*` servem como documentação, não como garantia operacional nesse modo.

Comando esperado de subida em produção:

```bash
docker compose -f docker-compose.prod.yml up -d --build --remove-orphans --scale worker=3
```

## Variáveis mínimas de produção

Além do bloco básico de domínio, SMTP, PostgreSQL, Redis e segredos Flask/JWT, a produção depende explicitamente de:

- `APP_DB_USER`
- `APP_DB_PASSWORD`
- `FRONTEND_URL`

Regras operacionais:
- `APP_DB_USER` deve ser diferente de `POSTGRES_USER`;
- `FRONTEND_URL` deve ser `https://<DOMAIN>`;
- se `S3_BACKUP_BUCKET` for preenchido, `AWS_ACCESS_KEY_ID` e `AWS_SECRET_ACCESS_KEY` passam a ser obrigatórios;
- se qualquer variável de Stripe for preenchida, o trio `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` e `STRIPE_PRICE_ID` deve existir por completo.

## GitHub Actions e segredos

### Deploy

Segredos obrigatórios no ambiente `production` do GitHub:
- `SSH_PRIVATE_KEY`
- `SERVER_HOST`
- `SERVER_USER`
- `SERVER_PATH`
- `DOMAIN`

Segredos opcionais para smoke test autenticado:
- `SMOKE_SUPERADMIN_USER`
- `SMOKE_SUPERADMIN_PASSWORD`
- `SMOKE_TENANT_SLUG`

Sem esses segredos opcionais, o deploy continua validando frontend, health e tenant discovery, mas pula o login real.

## Gates recomendados para go-live

- `./scripts/prod-preflight.sh` precisa passar com o `.env` real.
- `docker compose -f docker-compose.prod.yml config --quiet` precisa resolver sem placeholders.
- o deploy precisa subir com `--scale worker=3`.
- o smoke test precisa validar:
  - `GET /`
  - `GET /health`
  - `GET /api/v1/auth/tenants`
  - login real, se os segredos de smoke estiverem configurados

## Pendências restantes antes de produção ampla

- adicionar smoke E2E do worker RQ com execução de job real ponta a ponta;
- executar e registrar um restore drill real de backup em ambiente limpo;
- resolver o warning de bundle grande do frontend;
- revisar se a equipe vai manter `docker compose` ou migrar para um orquestrador que honre `deploy.resources`.
