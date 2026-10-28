import { afterAll, beforeEach } from 'vitest';
import { pool } from '../src/db/pool';

beforeEach(async () => {
  // TRUNCATE does not fire the row-level immutability trigger.
  await pool.query('TRUNCATE transactions, accounts RESTART IDENTITY CASCADE');
});

afterAll(async () => {
  await pool.end();
});
