#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

ALLOW_DIRTY="${ALLOW_DIRTY:-0}"
RUN_FRONTEND_AUDIT="${RUN_FRONTEND_AUDIT:-moderate}"
RUN_MOBILE_AUDIT="${RUN_MOBILE_AUDIT:-high}"
PIP_AUDIT_REQUIRED="${PIP_AUDIT_REQUIRED:-0}"
PROD_ENV_FILE="${PROD_ENV_FILE:-}"

section() {
  printf '\n==> %s\n' "$1"
}

if [ "$ALLOW_DIRTY" != "1" ] && [ -n "$(git status --porcelain)" ]; then
  echo "ERRO: worktree possui mudanças não commitadas. Use ALLOW_DIRTY=1 apenas para validação local." >&2
  git status --short >&2
  exit 1
fi

section "security: secret scan"
./scripts/scan-secrets.sh

section "backend: ruff"
cd "$ROOT_DIR/backend"
../.venv/bin/python -m ruff check app tests

section "backend: tests"
../.venv/bin/python -m pytest tests -q

section "backend: dependency audit"
if ../.venv/bin/python -m pip_audit --version >/dev/null 2>&1; then
  ../.venv/bin/python -m pip_audit
elif command -v pip-audit >/dev/null 2>&1; then
  pip-audit
elif [ "$PIP_AUDIT_REQUIRED" = "1" ]; then
  echo "ERRO: pip-audit não encontrado e PIP_AUDIT_REQUIRED=1." >&2
  exit 1
else
  echo "AVISO: pip-audit não encontrado; execute no CI/servidor antes do go-live."
fi

section "frontend: build"
cd "$ROOT_DIR/frontend"
npm run build

section "frontend: dependency audit"
case "$RUN_FRONTEND_AUDIT" in
  none)
    echo "AVISO: auditoria frontend pulada por RUN_FRONTEND_AUDIT=none."
    ;;
  high)
    npm audit --audit-level=high
    ;;
  moderate)
    npm audit --audit-level=moderate
    ;;
  *)
    echo "ERRO: RUN_FRONTEND_AUDIT deve ser none, high ou moderate." >&2
    exit 2
    ;;
esac

section "mobile: typecheck"
cd "$ROOT_DIR/mobile"
npm run typecheck

section "mobile: dependency audit"
case "$RUN_MOBILE_AUDIT" in
  none)
    echo "AVISO: auditoria mobile pulada por RUN_MOBILE_AUDIT=none."
    ;;
  high)
    npm audit --audit-level=high
    ;;
  moderate)
    npm audit --audit-level=moderate
    ;;
  *)
    echo "ERRO: RUN_MOBILE_AUDIT deve ser none, high ou moderate." >&2
    exit 2
    ;;
esac

section "production: compose preflight"
if [ -n "$PROD_ENV_FILE" ]; then
  cd "$ROOT_DIR"
  ./scripts/prod-preflight.sh "$PROD_ENV_FILE"
else
  echo "AVISO: preflight de produção pulado; defina PROD_ENV_FILE=/caminho/.env no servidor/CI."
fi

printf '\nRelease candidate checks concluídos.\n'
