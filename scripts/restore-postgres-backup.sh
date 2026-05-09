#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

BACKUP_FILE="${1:-}"

if [ -z "$BACKUP_FILE" ]; then
  echo "Uso: scripts/restore-postgres-backup.sh caminho/backup.sql.gz" >&2
  exit 1
fi

[ -f "$BACKUP_FILE" ] || {
  echo "Backup não encontrado: $BACKUP_FILE" >&2
  exit 1
}

[ -f .env ] || {
  echo "Arquivo .env não encontrado na raiz do projeto." >&2
  exit 1
}

while IFS='=' read -r key value; do
  case "$key" in
    ''|\#*) continue ;;
  esac
  key="$(printf '%s' "$key" | xargs)"
  value="$(printf '%s' "$value" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
  export "$key=$value"
done < .env

: "${POSTGRES_USER:?POSTGRES_USER não definido}"
: "${POSTGRES_DB:?POSTGRES_DB não definido}"

echo "ATENÇÃO: isto irá restaurar $BACKUP_FILE sobre o banco $POSTGRES_DB."
echo "Digite RESTAURAR para confirmar:"
read -r CONFIRM

if [ "$CONFIRM" != "RESTAURAR" ]; then
  echo "Restore cancelado."
  exit 1
fi

docker compose -f docker-compose.prod.yml up -d postgres
docker compose -f docker-compose.prod.yml exec -T postgres dropdb -U "$POSTGRES_USER" --if-exists "$POSTGRES_DB"
docker compose -f docker-compose.prod.yml exec -T postgres createdb -U "$POSTGRES_USER" "$POSTGRES_DB"

gzip -dc "$BACKUP_FILE" | docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U "$POSTGRES_USER" "$POSTGRES_DB" >/dev/null

docker compose -f docker-compose.prod.yml exec -T backend flask --app app db upgrade

echo "Restore concluído com sucesso."
