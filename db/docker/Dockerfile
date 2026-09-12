# Local development / test database: PostgreSQL 16 + pgTAP (for RLS policy tests).
# Production runs on Supabase (also Postgres 16 with pgTAP available) — same SQL everywhere.
FROM postgres:16
RUN apt-get update \
 && apt-get install -y --no-install-recommends postgresql-16-pgtap \
 && rm -rf /var/lib/apt/lists/*
