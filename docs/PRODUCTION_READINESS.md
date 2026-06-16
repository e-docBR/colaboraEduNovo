# Production Readiness

## Estado atual

O projeto está em estado de `staging forte / piloto controlado`.

O baseline técnico está funcional:
- backend validado com `ruff` limpo e `39` testes, incluindo regressões de hardening para alunos, notas, comunicados e degradação segura de IA/RQ;
- frontend com `eslint`, `tsc` e `vite build`;
- mobile com `tsc --noEmit`;
- compose de produção com Traefik, PostgreSQL, Redis, worker RQ e backup diário.

Os principais gaps operacionais identificados na auditoria foram fechados neste ciclo:
- o preflight de produção agora exige `APP_DB_USER`, `APP_DB_PASSWORD` e `FRONTEND_URL`;
- o compose de produção injeta Stripe, Sentry, WhatsApp instance e flags SMTP no backend;
- o setup Hetzner gera `.env` compatível com o preflight, valida antes de subir e usa `--scale worker=3`;
- validações de notas, dados de aluno, leitura de comunicados e upload WebP foram endurecidas;
- o bundle do frontend foi dividido por rota e por vendors pesados, removendo o warning de chunk grande;
- o deploy agora executa smoke E2E do RQ, enfileirando uma task real e aguardando processamento pelo worker;
- o restore script foi endurecido e o runbook de restore drill foi documentado em `docs/RESTORE_DRILL_RUNBOOK.md`;
- ILIKE pattern injection eliminado em todo o backend (escape_like helper + escape="\\");
- RBAC adicionado nas rotas admin do frontend (requireAdmin loader);
- race condition em AcademicYear corrigida com upsert atômico + unique constraint;
- validação de email/telefone adicionada antes do envio de notificações;
- assertion anti-dev-mode impede localhost em ALLOWED_ORIGINS em produção;
- Dockerfile convertido para multi-stage build (menor imagem runtime);
- backups obrigatoriamente encriptados com GPG/AES256 via BACKUP_ENCRYPTION_KEY;
- paginação centralizada em helper parse_pagination() (7 endpoints);
- o CI usa `VITE_API_BASE_URL`, que é a variável realmente consumida pelo frontend;
- o workflow de deploy usa `--scale worker=3`, compatível com `docker compose`;
- o smoke test de deploy valida frontend, `/health` e descoberta de tenants.
- `/metrics` agora exige JWT de `super_admin`; scrapers Prometheus precisam enviar `Authorization: Bearer <token>`.
- endpoints de leitura que calculam risco de IA agora degradam para `TREINANDO` ou `INDISPONIVEL` quando o modelo precisa ser treinado e Redis/RQ não aceita enqueue, em vez de retornar 500.

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
- `MONITOR_BASICAUTH`
- `BACKUP_ENCRYPTION_KEY`

Regras operacionais:
- `APP_DB_USER` deve ser diferente de `POSTGRES_USER`;
- `FRONTEND_URL` deve ser `https://<DOMAIN>`;
- `BACKUP_ENCRYPTION_KEY` deve ter pelo menos 32 caracteres; sem ela o serviço `pgbackup` recusa gerar dumps;
- se `S3_BACKUP_BUCKET` for preenchido, `AWS_ACCESS_KEY_ID` e `AWS_SECRET_ACCESS_KEY` passam a ser obrigatórios;
- se qualquer variável de Stripe for preenchida, o trio `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` e `STRIPE_PRICE_ID` deve existir por completo.

## Validação local mais recente

- `cd backend && ../.venv/bin/python -m pytest tests -q --cov-fail-under=0` passou; cobertura total reportada em torno de `53%`.
- `cd backend && ../.venv/bin/python -m ruff check app tests` passou.
- `./scripts/scan-secrets.sh` passou.
- `bash -n scripts/smoke-rq-worker.sh` passou.
- `bash -n scripts/restore-postgres-backup.sh` passou.
- `cd frontend && npm run build` passou.
- `cd frontend && npm audit --audit-level=moderate` passou após `npm audit fix`, com 0 vulnerabilidades reportadas.
- `frontend npm run lint` passou.
- `cd mobile && npm run typecheck` passou.
- `cd mobile && npm audit fix` removeu vulnerabilidades corrigíveis sem `--force`, mas `npm audit --audit-level=moderate` ainda reporta vulnerabilidades moderadas transitivas em `js-yaml` e `uuid` que exigem upgrades quebradores (`react-native@0.86.0` e/ou downgrade/alteração de `expo`) para resolução automática.
- `pip-audit` não está instalado no ambiente local usado nesta validação; executar em CI/servidor antes do go-live.
- `docker compose -f docker-compose.prod.yml config --quiet` passou; sem `.env` real, o Docker Compose ainda exibe avisos de variáveis vazias, o que é esperado fora do servidor.
- `scripts/release-candidate-check.sh` consolida os gates de RC.
- `scripts/production-http-smoke.sh` consolida o smoke HTTP de staging/produção.
- `scripts/setup-hetzner.sh` gera `ENCRYPTION_KEY`, além de `SECRET_KEY`, `JWT_SECRET_KEY` e `BACKUP_ENCRYPTION_KEY`, ficando compatível com `prod-preflight`.

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

O plano detalhado de execução está em `docs/PRODUCTION_GO_LIVE_PLAN.md` e o runbook executável está em `docs/PRODUCTION_PILOT_RUNBOOK.md`.

- `./scripts/prod-preflight.sh` precisa passar com o `.env` real.
- `docker compose -f docker-compose.prod.yml config --quiet` precisa resolver sem placeholders.
- `./scripts/release-candidate-check.sh` precisa passar na branch/tag do RC.
- o deploy precisa subir com `--scale worker=3`.
- o smoke test precisa validar:
  - `GET /`
  - `GET /health`
  - `GET /api/v1/auth/tenants`
  - `GET /metrics` com JWT de `super_admin`, quando houver scraper configurado
  - execução de job real no RQ
  - login real, se os segredos de smoke estiverem configurados

## Pendências restantes antes de produção ampla

- executar e registrar um restore drill real de backup em ambiente limpo seguindo `docs/RESTORE_DRILL_RUNBOOK.md`;
- executar auditoria Python com `pip-audit` no CI/servidor;
- decidir tratamento das vulnerabilidades moderadas restantes do mobile: aceitar formalmente para piloto controlado ou planejar upgrade testado de Expo/React Native antes da ampliação;
- revisar se a equipe vai manter `docker compose` ou migrar para um orquestrador que honre `deploy.resources`.
