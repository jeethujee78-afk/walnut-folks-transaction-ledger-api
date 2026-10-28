import type { PoolClient, QueryResult, QueryResultRow } from 'pg';
import { pool } from './pool';

/** Anything that can run a query: the pool (autocommit) or a client inside a transaction. */
export interface Db {
  query<R extends QueryResultRow = any>(text: string, values?: any[]): Promise<QueryResult<R>>;
}

export interface TransactionOptions {
  isolation?: 'READ COMMITTED' | 'REPEATABLE READ' | 'SERIALIZABLE';
  readOnly?: boolean;
}

/**
 * Runs `fn` inside a single database transaction. Commits if `fn` resolves,
 * rolls back everything if it throws.
 */
export async function withTransaction<T>(
  fn: (db: PoolClient) => Promise<T>,
  options: TransactionOptions = {},
): Promise<T> {
  const client = await pool.connect();
  let discard: Error | undefined;
  try {
    const begin = ['BEGIN'];
    if (options.isolation) begin.push(`ISOLATION LEVEL ${options.isolation}`);
    if (options.readOnly) begin.push('READ ONLY');
    await client.query(begin.join(' '));
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      // Connection is unusable; make sure the pool discards it.
      discard = rollbackErr as Error;
    }
    throw err;
  } finally {
    client.release(discard);
  }
}
