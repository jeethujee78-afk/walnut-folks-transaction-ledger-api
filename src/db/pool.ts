import { Pool } from 'pg';
import { env } from '../config/env';

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: env.DB_POOL_MAX,
  // Hosted providers such as Supabase require TLS. Their chain is not in Node's default
  // trust store for pooled hosts, so certificate verification is relaxed when enabled.
  ssl: env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  connectionTimeoutMillis: 10_000,
  idleTimeoutMillis: 30_000,
});

pool.on('error', (err) => {
  // Idle client errors must not crash the process. Message only: never log connection strings.
  console.error('Unexpected PostgreSQL pool error:', err.message);
});
