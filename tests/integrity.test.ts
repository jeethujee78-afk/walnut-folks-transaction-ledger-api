import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { pool } from '../src/db/pool';
import { transactionRepository } from '../src/repositories/transactionRepository';
import { app, createAccount, credit, debit, getBalance, history } from './helpers';

afterEach(() => vi.restoreAllMocks());

describe('immutability', () => {
  it.each(['put', 'patch', 'delete'] as const)('API rejects %s on a transaction and nothing changes', async (method) => {
    const id = await createAccount();
    const created = await credit(id, 100, 'r1');
    const txId = created.body.data.id;

    const item = await request(app)[method](`/accounts/${id}/transactions/${txId}`).send({ amount: 1 });
    const collection = await request(app)[method](`/accounts/${id}/transactions`).send({ amount: 1 });
    for (const res of [item, collection]) {
      expect(res.status).toBe(405);
      expect(res.body.error.code).toBe('TRANSACTIONS_IMMUTABLE');
    }

    const after = (await history(id)).body.data;
    expect(after).toHaveLength(1);
    expect(after[0]).toEqual(created.body.data);
    expect(await getBalance(id)).toBe(100);
  });

  it('the database itself refuses UPDATE and DELETE on transactions', async () => {
    const id = await createAccount();
    await credit(id, 100, 'r1');
    await expect(pool.query('UPDATE transactions SET amount = 1 WHERE account_id = $1', [id])).rejects.toThrow(/immutable/);
    await expect(pool.query('DELETE FROM transactions WHERE account_id = $1', [id])).rejects.toThrow(/immutable/);
  });
});

describe('database constraints', () => {
  it('rejects a negative balance', async () => {
    const id = await createAccount();
    await expect(pool.query('UPDATE accounts SET balance = -1 WHERE id = $1', [id])).rejects.toThrow(
      /accounts_balance_non_negative/,
    );
  });

  it('enforces UNIQUE(account_id, reference_id) below the application layer', async () => {
    const id = await createAccount();
    const insert = () =>
      pool.query(
        `INSERT INTO transactions (account_id, type, amount, balance_after, description, reference_id)
         VALUES ($1, 'credit', 10, 10, 'x', 'same')`,
        [id],
      );
    await insert();
    await expect(insert()).rejects.toThrow(/transactions_account_reference_unique/);
  });

  it('rejects invalid type and non-positive amount', async () => {
    const id = await createAccount();
    const raw = (type: string, amount: number) =>
      pool.query(
        `INSERT INTO transactions (account_id, type, amount, balance_after, description, reference_id)
         VALUES ($1, $2, $3, 0, 'x', gen_random_uuid()::text)`,
        [id, type, amount],
      );
    await expect(raw('refund', 10)).rejects.toThrow(/transactions_type_valid/);
    await expect(raw('credit', 0)).rejects.toThrow(/transactions_amount_range/);
  });
});

describe('atomicity', () => {
  it('rolls back the balance update when recording the transaction fails', async () => {
    const id = await createAccount();
    // The balance UPDATE has already executed inside the DB transaction when insert() throws.
    vi.spyOn(transactionRepository, 'insert').mockRejectedValueOnce(new Error('simulated failure'));

    const res = await credit(id, 500, 'will-fail');
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(res.body)).not.toContain('simulated');

    expect(await getBalance(id)).toBe(0);
    expect((await history(id)).body.pagination.total_records).toBe(0);

    // The same reference_id is still usable: the failed attempt left nothing behind.
    expect((await credit(id, 500, 'will-fail')).status).toBe(201);
    expect(await getBalance(id)).toBe(500);
  });

  it('keeps balance equal to the sum of its transactions', async () => {
    const id = await createAccount();
    await credit(id, 700, 'a');
    await debit(id, 200, 'b');
    await debit(id, 9999, 'rejected');
    await credit(id, 5, 'c');
    const { rows } = await pool.query(
      `SELECT COALESCE(SUM(CASE type WHEN 'credit' THEN amount ELSE -amount END), 0)::bigint AS total
         FROM transactions WHERE account_id = $1`,
      [id],
    );
    expect(Number(rows[0].total)).toBe(await getBalance(id));
    expect(await getBalance(id)).toBe(505);
  });
});
