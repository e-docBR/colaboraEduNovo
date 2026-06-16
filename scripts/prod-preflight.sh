#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

ENV_FILE="${1:-.env}"

fail() {
  printf 'ERRO: %s\n' "$1" >&2
  exit 1
}

require_file() {
  [ -e "$1" ] || fail "arquivo obrigatório não encontrado: $1"
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "comando obrigatório não encontrado: $1"
}

require_env() {
  local key="$1"
  local value="${!key:-}"
  [ -n "$value" ] || fail "variável $key não definida em $ENV_FILE"
  case "$value" in
    TROQUE_*|xxxxxxxxxxxxxxxx|SEU_TOKEN_*|admin:\$\$apr1\$\$TROQUE_*)
      fail "variável $key ainda parece conter valor placeholder"
      ;;
  esac
}

require_secret() {
  local key="$1"
  local value="${!key:-}"
  require_env "$key"
  [ "${#value}" -ge 32 ] || fail "$key deve ter pelo menos 32 caracteres"
}

require_file "$ENV_FILE"
require_cmd docker

while IFS='=' read -r key value; do
  case "$key" in
    ''|\#*) continue ;;
  esac
  key="$(printf '%s' "$key" | xargs)"
  value="$(printf '%s' "$value" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
  export "$key=$value"
done < "$ENV_FILE"

required_vars=(
  DOMAIN
  ACME_EMAIL
  MONITOR_BASICAUTH
  POSTGRES_USER
  POSTGRES_PASSWORD
  POSTGRES_DB
  APP_DB_USER
  APP_DB_PASSWORD
  REDIS_PASSWORD
  FLASK_ENV
  FRONTEND_URL
  SMTP_SERVER
  SMTP_PORT
  SMTP_USER
  SMTP_PASSWORD
  SMTP_FROM
)

for key in "${required_vars[@]}"; do
  require_env "$key"
done

require_secret SECRET_KEY
require_secret JWT_SECRET_KEY
require_secret ENCRYPTION_KEY
require_secret BACKUP_ENCRYPTION_KEY

[ "$FLASK_ENV" = "production" ] || fail "FLASK_ENV deve ser production"
[ "$SECRET_KEY" != "$JWT_SECRET_KEY" ] || fail "SECRET_KEY e JWT_SECRET_KEY devem ser diferentes"
[ "$SECRET_KEY" != "$ENCRYPTION_KEY" ] || fail "ENCRYPTION_KEY deve ser diferente de SECRET_KEY"
[ "$JWT_SECRET_KEY" != "$ENCRYPTION_KEY" ] || fail "ENCRYPTION_KEY deve ser diferente de JWT_SECRET_KEY"
[[ "$APP_DB_USER" != "$POSTGRES_USER" ]] || fail "APP_DB_USER deve ser diferente de POSTGRES_USER"
[[ "$DOMAIN" != http://* && "$DOMAIN" != https://* ]] || fail "DOMAIN deve conter apenas o host, sem protocolo"
[[ "$ACME_EMAIL" == *@* ]] || fail "ACME_EMAIL deve ser um e-mail válido"
[[ "$SMTP_FROM" == *@* ]] || fail "SMTP_FROM deve ser um e-mail válido"
[ "$FRONTEND_URL" = "https://${DOMAIN}" ] || fail "FRONTEND_URL deve ser https://${DOMAIN}"

if [ -n "${ALLOWED_ORIGINS:-}" ]; then
  [[ "$ALLOWED_ORIGINS" == *"https://"* ]] || fail "ALLOWED_ORIGINS deve usar HTTPS em produção"
  [[ "$ALLOWED_ORIGINS" != *"localhost"* && "$ALLOWED_ORIGINS" != *"127.0.0.1"* ]] || fail "ALLOWED_ORIGINS não pode conter localhost em produção"
fi

if [ -n "${S3_BACKUP_BUCKET:-}" ]; then
  require_env AWS_ACCESS_KEY_ID
  require_env AWS_SECRET_ACCESS_KEY
fi

if [ -n "${STRIPE_SECRET_KEY:-}" ] || [ -n "${STRIPE_WEBHOOK_SECRET:-}" ] || [ -n "${STRIPE_PRICE_ID:-}" ]; then
  require_env STRIPE_SECRET_KEY
  require_env STRIPE_WEBHOOK_SECRET
  require_env STRIPE_PRICE_ID
fi

env \
  DOMAIN="$DOMAIN" \
  ACME_EMAIL="$ACME_EMAIL" \
  MONITOR_BASICAUTH="$MONITOR_BASICAUTH" \
  POSTGRES_USER="$POSTGRES_USER" \
  POSTGRES_PASSWORD="$POSTGRES_PASSWORD" \
  POSTGRES_DB="$POSTGRES_DB" \
  APP_DB_USER="$APP_DB_USER" \
  APP_DB_PASSWORD="$APP_DB_PASSWORD" \
  REDIS_PASSWORD="$REDIS_PASSWORD" \
  SECRET_KEY="$SECRET_KEY" \
  JWT_SECRET_KEY="$JWT_SECRET_KEY" \
  ENCRYPTION_KEY="$ENCRYPTION_KEY" \
  BACKUP_ENCRYPTION_KEY="$BACKUP_ENCRYPTION_KEY" \
  FRONTEND_URL="$FRONTEND_URL" \
  SMTP_SERVER="$SMTP_SERVER" \
  SMTP_PORT="$SMTP_PORT" \
  SMTP_USER="$SMTP_USER" \
  SMTP_PASSWORD="$SMTP_PASSWORD" \
  SMTP_FROM="$SMTP_FROM" \
  AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID:-}" \
  AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY:-}" \
  S3_BACKUP_BUCKET="${S3_BACKUP_BUCKET:-}" \
  STRIPE_SECRET_KEY="${STRIPE_SECRET_KEY:-}" \
  STRIPE_WEBHOOK_SECRET="${STRIPE_WEBHOOK_SECRET:-}" \
  STRIPE_PRICE_ID="${STRIPE_PRICE_ID:-}" \
  docker compose -f docker-compose.prod.yml config --quiet

printf 'Preflight de produção OK para %s\n' "$DOMAIN"
