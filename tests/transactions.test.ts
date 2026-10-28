import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createAccount, credit, debit, getBalance, history, postTx } from './helpers';

describe('transactions', () => {
  it('credit increases the balance', async () => {
    const id = await createAccount();
    await credit(id, 100, 'seed');
    const res = await credit(id, 50, 'c1');
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      account_id: id, type: 'credit', amount: 50, balance_after: 150, reference_id: 'c1',
    });
    expect(await getBalance(id)).toBe(150);
  });

  it('debit decreases the balance', async () => {
    const id = await createAccount();
    await credit(id, 100, 'seed');
    const res = await debit(id, 30, 'd1');
    expect(res.status).toBe(201);
    expect(res.body.data.balance_after).toBe(70);
    expect(await getBalance(id)).toBe(70);
  });

  it('rejects an insufficient-balance debit and leaves the balance unchanged', async () => {
    const id = await createAccount();
    await credit(id, 100, 'seed');
    const res = await debit(id, 150, 'd1');
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('INSUFFICIENT_BALANCE');
    expect(await getBalance(id)).toBe(100);
    expect((await history(id)).body.pagination.total_records).toBe(1); // only the seed credit
  });

  it('allows debiting the exact balance (balance reaches 0, never below)', async () => {
    const id = await createAccount();
    await credit(id, 100, 'seed');
    expect((await debit(id, 100, 'd1')).status).toBe(201);
    expect(await getBalance(id)).toBe(0);
  });

  it('matches the assignment example: 100 + 50 - 30 - 20 = 100 (0 -> 100)', async () => {
    const id = await createAccount();
    await credit(id, 100, 'r1');
    await credit(id, 50, 'r2');
    await debit(id, 30, 'r3');
    await debit(id, 20, 'r4');
    expect(await getBalance(id)).toBe(100);
  });

  it.each([
    ['zero amount', 0],
    ['negative amount', -5],
    ['fractional amount', 10.5],
    ['string amount', '10'],
    ['null amount', null],
    ['amount above the cap', 100_000_000_001],
  ])('rejects %s', async (_label, amount) => {
    const id = await createAccount();
    const res = await postTx(id, { type: 'credit', amount, description: 'x', reference_id: 'r' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(await getBalance(id)).toBe(0);
  });

  it('rejects an invalid transaction type', async () => {
    const id = await createAccount();
    const res = await postTx(id, { type: 'refund', amount: 10, description: 'x', reference_id: 'r' });
    expect(res.status).toBe(400);
    expect(res.body.error.details[0].field).toBe('type');
  });

  it.each(['type', 'amount', 'description', 'reference_id'])('rejects a missing %s', async (field) => {
    const id = await createAccount();
    const body: Record<string, unknown> = { type: 'credit', amount: 10, description: 'x', reference_id: 'r' };
    delete body[field];
    const res = await postTx(id, body);
    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d: { field: string }) => d.field)).toContain(field);
  });

  it('rejects a blank reference_id', async () => {
    const id = await createAccount();
    const res = await postTx(id, { type: 'credit', amount: 10, description: 'x', reference_id: '   ' });
    expect(res.status).toBe(400);
  });

  it('returns 404 for a nonexistent account', async () => {
    const res = await credit(randomUUID(), 10, 'r');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('ACCOUNT_NOT_FOUND');
  });

  it('returns 400 for a malformed account id', async () => {
    const res = await credit('123', 10, 'r');
    expect(res.status).toBe(400);
  });

  it('rejects a duplicate reference_id without a second balance change', async () => {
    const id = await createAccount();
    const first = await credit(id, 100, 'dup');
    const second = await credit(id, 100, 'dup');
    expect(first.status).toBe(201);
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('DUPLICATE_TRANSACTION');
    expect(second.body.error.details.existing_transaction.id).toBe(first.body.data.id);
    expect(await getBalance(id)).toBe(100);
    expect((await history(id)).body.pagination.total_records).toBe(1);
  });

  it('treats a duplicate reference_id as a duplicate even if the payload differs', async () => {
    const id = await createAccount();
    await credit(id, 100, 'dup');
    const res = await debit(id, 10, 'dup');
    expect(res.status).toBe(409);
    expect(await getBalance(id)).toBe(100);
  });

  it('allows the same reference_id on different accounts', async () => {
    const [a, b] = [await createAccount('A'), await createAccount('B')];
    expect((await credit(a, 10, 'shared')).status).toBe(201);
    expect((await credit(b, 20, 'shared')).status).toBe(201);
    expect(await getBalance(a)).toBe(10);
    expect(await getBalance(b)).toBe(20);
  });
});
