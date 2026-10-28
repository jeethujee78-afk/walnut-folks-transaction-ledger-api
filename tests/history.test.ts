import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createAccount, credit, debit, history } from './helpers';

/** Seeds 5 transactions in a known order: c1(credit) d1(debit) c2 d2 c3. */
async function seed() {
  const id = await createAccount();
  await credit(id, 1000, 'c1');
  await debit(id, 100, 'd1');
  await credit(id, 500, 'c2');
  await debit(id, 50, 'd2');
  await credit(id, 25, 'c3');
  return id;
}

const refs = (res: { body: { data: { reference_id: string }[] } }) => res.body.data.map((t) => t.reference_id);

describe('transaction history', () => {
  it('returns every transaction, latest first', async () => {
    const id = await seed();
    const res = await history(id);
    expect(res.status).toBe(200);
    expect(refs(res)).toEqual(['c3', 'd2', 'c2', 'd1', 'c1']);
    expect(res.body.pagination).toEqual({ page: 1, limit: 20, total_records: 5, total_pages: 1 });
  });

  it('sorts latest-first by created_at', async () => {
    const id = await seed();
    const { data } = (await history(id)).body;
    const times = data.map((t: { created_at: string }) => new Date(t.created_at).getTime());
    expect([...times].sort((x, y) => y - x)).toEqual(times);
  });

  it('filters by credit', async () => {
    const id = await seed();
    const res = await history(id, '?type=credit');
    expect(refs(res)).toEqual(['c3', 'c2', 'c1']);
    expect(res.body.pagination.total_records).toBe(3);
  });

  it('filters by debit', async () => {
    const id = await seed();
    const res = await history(id, '?type=debit');
    expect(refs(res)).toEqual(['d2', 'd1']);
    expect(res.body.pagination.total_records).toBe(2);
  });

  it('paginates with page and limit and reports totals', async () => {
    const id = await seed();
    const p1 = await history(id, '?page=1&limit=2');
    const p2 = await history(id, '?page=2&limit=2');
    const p3 = await history(id, '?page=3&limit=2');
    expect(refs(p1)).toEqual(['c3', 'd2']);
    expect(refs(p2)).toEqual(['c2', 'd1']);
    expect(refs(p3)).toEqual(['c1']);
    expect(p2.body.pagination).toEqual({ page: 2, limit: 2, total_records: 5, total_pages: 3 });
  });

  it('combines type filter with pagination', async () => {
    const id = await seed();
    const res = await history(id, '?type=credit&page=2&limit=2');
    expect(refs(res)).toEqual(['c1']);
    expect(res.body.pagination).toEqual({ page: 2, limit: 2, total_records: 3, total_pages: 2 });
  });

  it('returns an empty page beyond the last page, and empty history for a new account', async () => {
    const id = await seed();
    const beyond = await history(id, '?page=9&limit=2');
    expect(beyond.status).toBe(200);
    expect(beyond.body.data).toEqual([]);
    expect(beyond.body.pagination.total_pages).toBe(3);

    const empty = await history(await createAccount());
    expect(empty.body.data).toEqual([]);
    expect(empty.body.pagination).toEqual({ page: 1, limit: 20, total_records: 0, total_pages: 0 });
  });

  it('only returns transactions of the requested account', async () => {
    const id = await seed();
    const other = await createAccount('Other');
    await credit(other, 1, 'other-1');
    expect((await history(id)).body.pagination.total_records).toBe(5);
    expect(refs(await history(other))).toEqual(['other-1']);
  });

  it.each([
    'page=0', 'page=-1', 'page=abc', 'page=1.5', 'limit=0', 'limit=101', 'limit=abc', 'type=refund', 'type=',
  ])('rejects invalid query %s', async (query) => {
    const id = await createAccount();
    const res = await history(id, `?${query}`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 404 for a nonexistent account and 400 for a malformed id', async () => {
    expect((await history(randomUUID())).status).toBe(404);
    expect((await history('nope')).status).toBe(400);
  });
});
