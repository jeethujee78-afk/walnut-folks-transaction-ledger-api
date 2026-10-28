import type { AccountRow } from '../repositories/accountRepository';
import type { TransactionRow } from '../repositories/transactionRepository';
import { toApiMoney } from '../utils/money';

export const toAccountDto = (row: AccountRow) => ({
  id: row.id,
  name: row.name,
  balance: toApiMoney(row.balance),
  created_at: row.created_at.toISOString(),
});

export const toTransactionDto = (row: TransactionRow) => ({
  id: row.id,
  account_id: row.account_id,
  type: row.type,
  amount: toApiMoney(row.amount),
  balance_after: toApiMoney(row.balance_after),
  description: row.description,
  reference_id: row.reference_id,
  created_at: row.created_at.toISOString(),
});
