import { existsSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

// Load .env if present (Node >= 20.12). Real environment variables always win.
const envFile = path.resolve(process.cwd(), '.env');
if (existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DATABASE_SSL: z.enum(['true', 'false']).default('false'),
  DB_POOL_MAX: z.coerce.number().int().min(1).max(50).default(10),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const problems = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
  // Never print values: they may contain credentials.
  throw new Error(`Invalid environment configuration: ${problems}`);
}

export const env = parsed.data;
