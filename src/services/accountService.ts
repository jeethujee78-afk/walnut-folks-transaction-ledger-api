import { pool } from '../db/pool';
import { Errors } from '../errors/AppError';
import { accountRepository } from '../repositories/accountRepository';
import { toApiMoney } from '../utils/money';
import { toAccountDto } from './mappers';

export const accountService = {
  async create(name: string) {
    return toAccountDto(await accountRepository.create(pool, name));
  },

  async getBalance(accountId: string) {
    const account = await accountRepository.findById(pool, accountId);
    if (!account) throw Errors.accountNotFound(accountId);
    return { account_id: account.id, balance: toApiMoney(account.balance) };
  },
};
