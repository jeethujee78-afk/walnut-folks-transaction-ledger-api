import { createApp } from './app';
import { env } from './config/env';
import { pool } from './db/pool';

const server = createApp().listen(env.PORT, () => {
  console.log(`Ledger API listening on port ${env.PORT} (docs at /docs)`);
});

function shutdown(signal: string) {
  console.log(`${signal} received, shutting down`);
  server.close(() => {
    pool.end().finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
