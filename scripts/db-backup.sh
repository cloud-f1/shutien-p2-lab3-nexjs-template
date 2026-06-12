#!/usr/bin/env bash
set -euo pipefail

# Backup PostgreSQL from Docker container
# Usage: make db-backup

BACKUP_DIR="backups"
TIMESTAMP=$(date +%Y-%m-%d_%H%M%S)
DB_USER="${POSTGRES_USER:-saas_user}"
DB_NAME="${POSTGRES_DB:-saas_dev}"
CONTAINER=$(docker compose ps -q db 2>/dev/null)

if [ -z "$CONTAINER" ]; then
    echo "❌ No running 'db' container found."
    echo "   Start it with: docker compose up -d db"
    exit 1
fi

mkdir -p "$BACKUP_DIR"
BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_${TIMESTAMP}.sql.gz"

echo "🐘 Backing up ${DB_NAME}..."
docker exec "$CONTAINER" pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_FILE"

SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "✅ Backup saved: $BACKUP_FILE ($SIZE)"
echo ""
echo "To restore:"
echo "  gunzip -c $BACKUP_FILE | docker exec -i \$(docker compose ps -q db) psql -U $DB_USER $DB_NAME"
