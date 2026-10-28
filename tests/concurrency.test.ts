import { describe, expect, it } from 'vitest';
import { createAccount, credit, debit, getBalance, history } from './helpers';

describe('concurrency', () => {
  it('never overdraws: 100 balance, concurrent debits of 80 and 50 -> exactly one succeeds', async () => {
    const id = await createAccount();
    await credit(id, 100, 'seed');

    const [a, b] = await Promise.all([debit(id, 80, 'A'), debit(id, 50, 'B')]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([201, 422]);

    const balance = await getBalance(id);
    expect([20, 50]).toContain(balance);
    expect(balance).toBeGreaterThanOrEqual(0);
  });

  it('many concurrent debits: only as many succeed as the balance allows', async () => {
    const id = await createAccount();
    await credit(id, 100, 'seed');

    const results = await Promise.all(Array.from({ length: 10 }, (_, i) => debit(id, 30, `d${i}`)));
    expect(results.filter((r) => r.status === 201)).toHaveLength(3);
    expect(results.filter((r) => r.status === 422)).toHaveLength(7);
    expect(await getBalance(id)).toBe(10);
  });

  it('concurrent duplicate reference_ids produce exactly one balance change', async () => {
    const id = await createAccount();
    const results = await Promise.all(Array.from({ length: 8 }, () => credit(id, 100, 'same-ref')));
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(7);
    expect(await getBalance(id)).toBe(100);
    expect((await history(id)).body.pagination.total_records).toBe(1);
  });

  it('concurrent credits and debits stay consistent with the ledger', async () => {
    const id = await createAccount();
    await credit(id, 1000, 'seed');
    const ops = Array.from({ length: 20 }, (_, i) =>
      i % 2 === 0 ? credit(id, 10, `c${i}`) : debit(id, 10, `d${i}`),
    );
    const results = await Promise.all(ops);
    expect(results.every((r) => r.status === 201)).toBe(true);
    expect(await getBalance(id)).toBe(1000);
    expect((await history(id)).body.pagination.total_records).toBe(21);
  });
});
