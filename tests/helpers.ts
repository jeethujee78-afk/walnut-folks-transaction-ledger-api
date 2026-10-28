import request from 'supertest';
import { createApp } from '../src/app';

export const app = createApp();

export async function createAccount(name = 'Test User'): Promise<string> {
  const res = await request(app).post('/accounts').send({ name });
  if (res.status !== 201) throw new Error(`createAccount failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.data.id;
}

export const postTx = (
  accountId: string,
  body: Record<string, unknown>,
) => request(app).post(`/accounts/${accountId}/transactions`).send(body);

export const credit = (accountId: string, amount: number, reference_id: string) =>
  postTx(accountId, { type: 'credit', amount, description: 'credit', reference_id });

export const debit = (accountId: string, amount: number, reference_id: string) =>
  postTx(accountId, { type: 'debit', amount, description: 'debit', reference_id });

export async function getBalance(accountId: string): Promise<number> {
  const res = await request(app).get(`/accounts/${accountId}/balance`);
  return res.body.data.balance;
}

export const history = (accountId: string, query = '') =>
  request(app).get(`/accounts/${accountId}/transactions${query}`);
