import { loadTestDatabaseUrl } from './loadTestEnv';

// Runs before tests/setup.ts (setupFiles execute in order), so every application module
// imported afterwards connects to the test database.
process.env.DATABASE_URL = loadTestDatabaseUrl();
