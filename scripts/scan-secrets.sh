#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

status=0

fail() {
  printf '[ERR] %s\n' "$1" >&2
  status=1
}

warn_matches() {
  local label="$1"
  local pattern="$2"
  local matches

  matches="$(
    git ls-files --cached --others --exclude-standard -z \
      | xargs -0 --no-run-if-empty rg -nI --with-filename --pcre2 \
          --glob '!scripts/scan-secrets.sh' \
          --glob '!**/package-lock.json' \
          --glob '!frontend/node_modules/**' \
          --glob '!mobile/node_modules/**' \
          --glob '!backend/.venv/**' \
          "$pattern" 2>/dev/null || true
  )"

  if [ -n "$matches" ]; then
    printf '[ERR] Possível segredo encontrado: %s\n%s\n' "$label" "$matches" >&2
    status=1
  fi
}

if [ -e install_key.py ]; then
  fail "install_key.py não pode voltar ao repositório"
fi

while IFS= read -r env_file; do
  case "$env_file" in
    .env.example|*.example) ;;
    *) fail "arquivo de ambiente versionado: $env_file" ;;
  esac
done < <(git ls-files '.env*')

warn_matches "chave privada" '-----BEGIN [A-Z ]*PRIVATE KEY-----'
warn_matches "token GitHub" 'gh[pousr]_[A-Za-z0-9_]{30,}'
warn_matches "chave AWS" 'AKIA[0-9A-Z]{16}'
warn_matches "Stripe live secret" 'sk_live_[A-Za-z0-9]{20,}'
warn_matches "Sentry DSN real" 'https://[a-f0-9]{32}@[A-Za-z0-9.-]+/[0-9]+'

if [ "$status" -eq 0 ]; then
  echo "[OK] scan de segredos sem achados"
fi

exit "$status"
