import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app, createAccount, getBalance } from './helpers';

describe('accounts', () => {
  it('creates an account with a server-generated id/timestamp and zero balance', async () => {
    const res = await request(app).post('/accounts').send({ name: '  Asha Verma  ' });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ name: 'Asha Verma', balance: 0 });
    expect(res.body.data.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(new Date(res.body.data.created_at).getTime()).not.toBeNaN();
  });

  it('gives every account a unique id', async () => {
    const [a, b] = [await createAccount('A'), await createAccount('A')];
    expect(a).not.toBe(b);
  });

  it('starts with a zero balance', async () => {
    const id = await createAccount();
    const res = await request(app).get(`/accounts/${id}/balance`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ account_id: id, balance: 0 });
  });

  it.each([
    ['missing name', {}],
    ['blank name', { name: '   ' }],
    ['non-string name', { name: 42 }],
  ])('rejects %s', async (_label, body) => {
    const res = await request(app).post('/accounts').send(body);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('does not let the client set the initial balance', async () => {
    const res = await request(app).post('/accounts').send({ name: 'Cheater', balance: 1_000_000 });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 404 for a nonexistent account balance', async () => {
    const res = await request(app).get(`/accounts/${randomUUID()}/balance`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('ACCOUNT_NOT_FOUND');
  });

  it('returns 400 for a malformed account id', async () => {
    const res = await request(app).get('/accounts/not-a-uuid/balance');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 INVALID_JSON for a malformed body', async () => {
    const res = await request(app).post('/accounts').set('Content-Type', 'application/json').send('{"name": ');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
  });

  it('returns a JSON 404 for unknown routes', async () => {
    const res = await request(app).get('/nope');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('ROUTE_NOT_FOUND');
    expect(await getBalance(await createAccount())).toBe(0);
  });
});
