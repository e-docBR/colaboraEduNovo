#!/bin/sh
set -eu

echo "[pgbackup] Installing rclone and gnupg..."
apk add --no-cache rclone gnupg >/dev/null 2>&1 || echo "[pgbackup] optional packages unavailable"

cat > /usr/local/bin/run_backup.sh <<'RUNBACKUP'
#!/bin/sh
set -eu

TIMESTAMP=$(date +%Y%m%d_%H%M%S)

if [ -z "${BACKUP_ENCRYPTION_KEY:-}" ]; then
  echo "[pgbackup] FATAL: BACKUP_ENCRYPTION_KEY not set"
  exit 1
fi

FILENAME=/backups/backup_${TIMESTAMP}.sql.gz.gpg
echo "[pgbackup] Starting encrypted backup -> ${FILENAME}"

pg_dump -h postgres -U "$POSTGRES_USER" "$POSTGRES_DB" \
  | gzip \
  | gpg --batch --symmetric --cipher-algo AES256 --passphrase "$BACKUP_ENCRYPTION_KEY" \
  > "$FILENAME"

SIZE=$(stat -c%s "$FILENAME" 2>/dev/null || echo 0)
if [ "$SIZE" -lt 1024 ]; then
  echo "[pgbackup] FAILED: dump too small (${SIZE} bytes)"
  rm -f "$FILENAME"
  exit 1
fi

echo "[pgbackup] OK: ${FILENAME} (${SIZE} bytes)"
find /backups -name "backup_*.sql.gz*" -mtime +30 -delete

if [ -n "${S3_BACKUP_BUCKET:-}" ] && command -v rclone >/dev/null 2>&1; then
  echo "[pgbackup] Uploading to s3:${S3_BACKUP_BUCKET} ..."
  rclone copy "$FILENAME" ":s3:${S3_BACKUP_BUCKET}" \
    --s3-access-key-id="$AWS_ACCESS_KEY_ID" \
    --s3-secret-access-key="$AWS_SECRET_ACCESS_KEY" \
    --s3-region="${AWS_DEFAULT_REGION:-us-east-1}" \
    ${S3_ENDPOINT:+--s3-endpoint="$S3_ENDPOINT"} \
    && echo "[pgbackup] S3 upload OK" \
    || echo "[pgbackup] S3 upload FAILED (local backup kept)"
fi
RUNBACKUP

chmod +x /usr/local/bin/run_backup.sh

echo "0 2 * * * /usr/local/bin/run_backup.sh >> /proc/1/fd/1 2>&1" | crontab -
echo "[pgbackup] Cron scheduled. Running initial backup now..."
/usr/local/bin/run_backup.sh || echo "[pgbackup] Initial backup failed"

exec crond -f -l 2
