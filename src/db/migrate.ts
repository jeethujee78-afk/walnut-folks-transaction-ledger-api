import { pool } from './pool';
import { runMigrations } from './migrator';

runMigrations(pool)
  .then((applied) => {
    console.log(applied.length ? `Applied migrations: ${applied.join(', ')}` : 'Database is up to date.');
  })
  .catch((err: Error) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
