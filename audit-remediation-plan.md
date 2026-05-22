# Plano de Remediação da Auditoria

## Goal
Corrigir primeiro os riscos de autenticação, isolamento multi-tenant e contratos quebrados entre backend, frontend e mobile, depois validar o sistema com checks executáveis.

## Tasks
- [x] Corrigir o contrato de autenticação entre backend, frontend web e mobile → Verify: login, refresh e logout usam o mesmo fluxo sem campos/rotas divergentes.
- [x] Implementar rotação real de refresh token e endurecer `/health/detailed` → Verify: refresh invalida o token anterior e health detalhado exige JWT válido não revogado.
- [x] Remover fallback inseguro de tenant `default` fora de dev/local e blindar rotas `super_admin` contra filtro global de tenant → Verify: host inválido falha com 404 e operações admin usam o tenant-alvo correto.
- [x] Corrigir chamadas do frontend para exclusão/admin e CORS com cookies HttpOnly → Verify: web consegue refresh com `credentials: include` e exclusão envia `confirm_delete`.
- [x] Ajustar cliente mobile para rotas e payloads reais do backend → Verify: mobile usa `/auth/tenants`, lida com `refresh_token` de forma compatível e não chama refresh inválido.
- [x] Executar validações disponíveis e registrar bloqueios do ambiente → Verify: ruff/pytest/npm checks executados ou bloqueios documentados com causa concreta.

## Done When
- [x] Fluxo web de sessão está consistente com cookie HttpOnly.
- [x] Fluxo mobile não depende mais de endpoint inexistente.
- [x] Resolução de tenant falha de forma segura.
- [x] Rotas `super_admin` não sofrem interferência do tenant global da UI.
- [x] Validações executadas ou bloqueios claramente documentados.

## Validation Notes
- `python3` + `ast.parse(...)` validou a sintaxe dos arquivos Python alterados sem erros.
- `python3 -m pytest backend/tests/test_auth.py backend/tests/test_health.py` bloqueado por `ModuleNotFoundError: fakeredis`.
- Após fallback local de Redis no `conftest.py`, `pytest` segue bloqueado porque o ambiente não possui dependências base do backend (`ModuleNotFoundError: sqlalchemy`).
- `python3 -m py_compile ...` bloqueado por permissão de escrita em `backend/app/api/v1/__pycache__`.
- `frontend` e `mobile` não possuem `node_modules/.bin`, então `tsc/eslint` locais não estão instalados de forma executável.
- A validação correta do backend usa a `.venv` da raiz: `make validate-backend` passou com `ruff` limpo e `19` testes (`auth` + `health`) aprovados.
- `make doctor` falha de propósito enquanto `frontend/node_modules/.bin/{tsc,vite,eslint}` e `mobile/node_modules/.bin/tsc` não existirem.

## Next Phases
- [x] Fase 2 — Destravar testes sem dependência obrigatória de `fakeredis`.
- [x] Fase 3 — Garantir revogação de sessão no logout web/mobile e no ciclo de troca de senha.
- [x] Fase 4 — Revisar inconsistências restantes de bootstrap, filas e documentação operacional.
- [x] Fase 5 — Consolidar validação executável quando o ambiente tiver dependências Python/Node instaladas.

## Fase 5 — Entregas
- Adicionados `make doctor`, `make validate`, `make validate-backend`, `make validate-frontend` e `make validate-mobile`.
- Adicionados scripts `scripts/doctor.sh` e `scripts/validate-workspace.sh` para evitar fallback acidental para toolchains globais.
- README do backend atualizado para refletir o fluxo real de autenticação web/mobile e a `.venv` da raiz.
- README do frontend atualizado para exigir `npm install --include=dev`.
- README inicial do mobile criado com setup e validação.

## Fase 5 — Resultado no ambiente atual
- Backend validado pela `.venv` da raiz; o erro anterior de `sqlalchemy` ausente vinha do `python3` global, não do ambiente do projeto.
- `ruff` encontrou um bug funcional real em `backend/app/__init__.py`: uso de `@jwt_required()` sem import.
- Frontend continua com instalação local incompleta: há `node_modules`, mas faltam binários em `node_modules/.bin`.
- Mobile continua sem `node_modules`, então `tsc` local ainda não está disponível.
- Após a correção do import e limpeza do lote, `make validate-backend` ficou verde.

## Fase 6 — Hardening da validação JS
- `mobile` teve as dependências instaladas localmente e o typecheck passou.
- `frontend` revelou problemas reais de lint e TypeScript; esses erros foram corrigidos.
- `scripts/validate-workspace.sh` agora usa fallback em cópia temporária para `frontend` e `mobile` quando `node_modules` local está ausente ou quebrado.
- `make validate` não depende mais de `make doctor` para prosseguir; o `doctor` segue informativo, enquanto a validação tenta se recuperar sozinha.
- `make validate` agora passa no ambiente atual: backend (`ruff` + 19 testes), frontend (`eslint` + `tsc` + `vite build` em fallback temporário) e mobile (`tsc --noEmit`).
- Pendência operacional remanescente: `frontend/node_modules` continua com ownership `root:root`, então o fallback ainda é necessário até o diretório ser corrigido fora do sandbox.

## Fase 7 — GitHub e documentação operacional
- `scripts/prod-preflight.sh` agora falha cedo se faltarem `APP_DB_USER`, `APP_DB_PASSWORD` ou `FRONTEND_URL`, e valida integrações opcionais de S3/Stripe de forma consistente.
- `.github/workflows/ci.yml` passou a usar `VITE_API_BASE_URL`, alinhado ao contrato real do frontend, e o preflight sintético de produção inclui o app user do PostgreSQL.
- `.github/workflows/deploy.yml` passou a subir produção com `--scale worker=3` e adicionou smoke test para frontend, `/health` e `/api/v1/auth/tenants`, com login opcional via segredos dedicados.
- `README.md` e `docs/DEPLOYMENT.md` foram alinhados ao modelo real de deploy com `docker compose`.
- `docs/PRODUCTION_READINESS.md` foi criado para registrar o estado real do sistema, os gates de go-live e as pendências restantes antes de produção ampla.
