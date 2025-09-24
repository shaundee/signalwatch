mkdir -p scripts supabase/schema

cat > scripts/db_dump.sh << 'EOF'
#!/usr/bin/env bash
set -euo pipefail

# === Config ===
HOST="aws-1-eu-west-2.pooler.supabase.com"
USER="postgres.dxwazefwdmfmyfariarj"
DB="postgres"
OUT="supabase/schema/schema_snapshot.sql"

# Ensure PGPASSWORD is set
if [ -z "${PGPASSWORD:-}" ]; then
  echo "❌ PGPASSWORD not set. Run: export PGPASSWORD='<your-db-password>'"
  exit 1
fi

export PGSSLMODE=require

# Find pg_dump (installed via Scoop)
PGDUMP="/c/Users/shawn/scoop/apps/postgresql/current/bin/pg_dump.exe"

mkdir -p "$(dirname "$OUT")"

echo "🔄 Dumping schema from $HOST ..."
"$PGDUMP" -h "$HOST" -p 5432 -U "$USER" -d "$DB" \
  --schema-only --no-owner --no-privileges \
  -f "$OUT"

echo "✅ Schema written to $OUT"
EOF

chmod +x scripts/db_dump.sh


             #how to use
#export PGPASSWORD="<YOUR_DB_PASSWORD>"
#./scripts/db_dump.sh
# git add supabase/schema/schema_snapshot.sql
#git commit -m "chore: update Supabase schema snapshot"
