import { Pool } from 'pg';
import { runMigrations } from '../src/db/migrator';
import { loadTestDatabaseUrl } from './loadTestEnv';

export default async function setup() {
  const pool = new Pool({
    connectionString: loadTestDatabaseUrl(),
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  });
  try {
    await runMigrations(pool);
  } finally {
    await pool.end();
  }
}
