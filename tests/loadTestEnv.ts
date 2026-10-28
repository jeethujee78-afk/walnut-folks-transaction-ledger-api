import { existsSync } from 'node:fs';
import path from 'node:path';

/** Returns the test database URL, refusing to run against the application database. */
export function loadTestDatabaseUrl(): string {
  const envFile = path.resolve(process.cwd(), '.env');
  if (existsSync(envFile)) process.loadEnvFile(envFile);

  const testUrl = process.env.TEST_DATABASE_URL;
  if (!testUrl) {
    throw new Error('TEST_DATABASE_URL is not set. Point it at a separate, disposable database (see README).');
  }
  if (testUrl === process.env.DATABASE_URL) {
    throw new Error('TEST_DATABASE_URL must differ from DATABASE_URL: the tests truncate all ledger tables.');
  }
  return testUrl;
}
