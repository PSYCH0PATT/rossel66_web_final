# PostgreSQL monitoring (pg_stat_statements & cache)

Run these on your Supabase / Postgres instance (SQL editor or `psql`).  
Requires sufficient privileges (extension may need to be enabled once by a superuser).

## Enable `pg_stat_statements`

```sql
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
```

## Top slow queries (by total time)

```sql
SELECT
  calls,
  round(mean_exec_time::numeric, 2) AS mean_ms,
  round(total_exec_time::numeric, 2) AS total_ms,
  left(query, 200) AS query_preview
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 20;
```

## Index usage

```sql
SELECT
  schemaname,
  relname,
  indexrelname,
  idx_scan,
  idx_tup_read
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC
LIMIT 40;
```

## Buffer cache hit ratio (target: >99% on hot workloads)

```sql
SELECT
  sum(heap_blks_hit)::float /
  nullif(sum(heap_blks_hit) + sum(heap_blks_read), 0) AS heap_hit_ratio
FROM pg_statio_user_tables;
```

Reset stats after schema changes (optional):

```sql
-- SELECT pg_stat_statements_reset();
```

Notes:

- On managed Postgres, `pg_stat_statements` may already be enabled; if `CREATE EXTENSION` fails, check provider docs.
- Use these queries after deploying new indexes (`prisma migrate deploy`) to confirm plans improve.
