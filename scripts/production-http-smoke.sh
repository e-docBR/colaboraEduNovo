#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-${1:-}}"
SMOKE_SUPERADMIN_USER="${SMOKE_SUPERADMIN_USER:-}"
SMOKE_SUPERADMIN_PASSWORD="${SMOKE_SUPERADMIN_PASSWORD:-}"
SMOKE_TENANT_SLUG="${SMOKE_TENANT_SLUG:-}"

if [ -z "$BASE_URL" ]; then
  echo "Uso: BASE_URL=https://app.exemplo.com $0" >&2
  exit 2
fi

BASE_URL="${BASE_URL%/}"
COOKIE_JAR="$(mktemp)"
LOGIN_BODY="$(mktemp)"

cleanup() {
  rm -f "$COOKIE_JAR" "$LOGIN_BODY"
}
trap cleanup EXIT

require_status() {
  local label="$1"
  local expected="$2"
  shift 2
  local status
  status="$(curl -fsS -o /tmp/colabora-smoke-body -w "%{http_code}" "$@")"
  if [ "$status" != "$expected" ]; then
    echo "ERRO: $label retornou HTTP $status; esperado $expected" >&2
    cat /tmp/colabora-smoke-body >&2 || true
    exit 1
  fi
  echo "OK: $label -> $status"
}

require_status "frontend /" "200" "$BASE_URL/"

health_json="$(curl -fsS "$BASE_URL/health")"
db_status="$(printf '%s' "$health_json" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("checks",{}).get("database","unknown"))')"
redis_status="$(printf '%s' "$health_json" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("checks",{}).get("redis","unknown"))')"
if [ "$db_status" != "ok" ] || [ "$redis_status" != "ok" ]; then
  echo "ERRO: /health dependências inválidas: database=$db_status redis=$redis_status" >&2
  exit 1
fi
echo "OK: /health -> database=$db_status redis=$redis_status"

require_status "tenant discovery" "200" "$BASE_URL/api/v1/auth/tenants"

metrics_public_status="$(curl -sS -o /tmp/colabora-smoke-body -w "%{http_code}" "$BASE_URL/metrics" || true)"
case "$metrics_public_status" in
  401|422)
    echo "OK: /metrics sem JWT negado -> $metrics_public_status"
    ;;
  *)
    echo "ERRO: /metrics sem JWT retornou $metrics_public_status; esperado 401/422" >&2
    cat /tmp/colabora-smoke-body >&2 || true
    exit 1
    ;;
esac

detailed_public_status="$(curl -sS -o /tmp/colabora-smoke-body -w "%{http_code}" "$BASE_URL/health/detailed" || true)"
case "$detailed_public_status" in
  401|422)
    echo "OK: /health/detailed sem JWT negado -> $detailed_public_status"
    ;;
  *)
    echo "ERRO: /health/detailed sem JWT retornou $detailed_public_status; esperado 401/422" >&2
    cat /tmp/colabora-smoke-body >&2 || true
    exit 1
    ;;
esac

if [ -z "$SMOKE_SUPERADMIN_USER" ] || [ -z "$SMOKE_SUPERADMIN_PASSWORD" ] || [ -z "$SMOKE_TENANT_SLUG" ]; then
  echo "AVISO: login/refresh/logout/metrics autenticado pulados; defina SMOKE_SUPERADMIN_USER, SMOKE_SUPERADMIN_PASSWORD e SMOKE_TENANT_SLUG."
  exit 0
fi

login_status="$(
  curl -sS -o "$LOGIN_BODY" -w "%{http_code}" \
    -c "$COOKIE_JAR" \
    -X POST "$BASE_URL/api/v1/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"${SMOKE_SUPERADMIN_USER}\",\"password\":\"${SMOKE_SUPERADMIN_PASSWORD}\",\"tenant_slug\":\"${SMOKE_TENANT_SLUG}\"}"
)"
if [ "$login_status" != "200" ]; then
  echo "ERRO: login retornou HTTP $login_status" >&2
  cat "$LOGIN_BODY" >&2
  exit 1
fi
echo "OK: login -> 200"

access_token="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["access_token"])' "$LOGIN_BODY")"

refresh_status="$(
  curl -sS -o /tmp/colabora-smoke-body -w "%{http_code}" \
    -b "$COOKIE_JAR" -c "$COOKIE_JAR" \
    -X POST "$BASE_URL/api/v1/auth/refresh"
)"
if [ "$refresh_status" != "200" ]; then
  echo "ERRO: refresh retornou HTTP $refresh_status" >&2
  cat /tmp/colabora-smoke-body >&2 || true
  exit 1
fi
echo "OK: refresh -> 200"

require_status "metrics autenticado" "200" -H "Authorization: Bearer ${access_token}" "$BASE_URL/metrics"
require_status "health detailed autenticado" "200" -H "Authorization: Bearer ${access_token}" "$BASE_URL/health/detailed"

logout_status="$(
  curl -sS -o /tmp/colabora-smoke-body -w "%{http_code}" \
    -b "$COOKIE_JAR" -c "$COOKIE_JAR" \
    -X POST "$BASE_URL/api/v1/auth/logout" \
    -H "Authorization: Bearer ${access_token}"
)"
if [ "$logout_status" != "204" ]; then
  echo "ERRO: logout retornou HTTP $logout_status" >&2
  cat /tmp/colabora-smoke-body >&2 || true
  exit 1
fi
echo "OK: logout -> 204"

echo "Smoke HTTP de produção concluído."
