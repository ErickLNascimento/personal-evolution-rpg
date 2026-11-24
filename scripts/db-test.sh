#!/usr/bin/env bash
# Roda os testes SQL (RLS, XP, Cristais, social…) num Postgres 17 descartável no Docker,
# do mesmo jeito que o job "database" da CI: stub do Supabase, todas as migrations e o teste.
# Uso (na raiz do repositório): ./scripts/db-test.sh
set -euo pipefail
cd "$(dirname "$0")/.."
docker rm -f per-pg >/dev/null 2>&1 || true
docker run -d --name per-pg -e POSTGRES_PASSWORD=postgres postgres:17 >/dev/null
for _ in $(seq 1 60); do docker exec per-pg pg_isready -U postgres >/dev/null 2>&1 && break; sleep 1; done
sleep 1
run() { MSYS_NO_PATHCONV=1 docker exec -i per-pg psql -U postgres -v ON_ERROR_STOP=1 -q -f - < "$1"; }
run supabase/sql-tests/00_supabase_stub.sql
for f in supabase/migrations/*.sql; do echo "→ $f"; run "$f"; done
echo "== testes =="
run supabase/sql-tests/10_rls_and_xp.test.sql
docker rm -f per-pg >/dev/null
echo "== OK =="
