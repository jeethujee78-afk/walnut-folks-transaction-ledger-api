import { pool } from '../db/pool';
import { withTransaction } from '../db/transaction';
import { Errors } from '../errors/AppError';
import { accountRepository } from '../repositories/accountRepository';
import { transactionRepository } from '../repositories/transactionRepository';
import { isCheckViolation, isUniqueViolation } from '../utils/dbErrors';
import { toApiMoney } from '../utils/money';
import type { CreateTransactionInput, ListTransactionsQuery } from '../validators/transaction';
import { toTransactionDto } from './mappers';

const UNIQUE_REFERENCE = 'transactions_account_reference_unique';
const BALANCE_MAX = 'accounts_balance_max';

export const transactionService = {
  /**
   * Atomically records a credit/debit and updates the balance.
   *
   * Concurrency: the account row is locked (SELECT ... FOR UPDATE) first, so all ledger
   * operations on one account are serialized. Under the lock we (1) detect duplicate
   * reference_ids, (2) apply a conditional UPDATE that refuses to go below zero, and
   * (3) insert the transaction. Any failure rolls back the whole transaction.
   * Backstops: UNIQUE(account_id, reference_id) and CHECK(balance >= 0).
   */
  async create(accountId: string, input: CreateTransactionInput) {
    try {
      const row = await withTransaction(async (db) => {
        const account = await accountRepository.lockById(db, accountId);
        if (!account) throw Errors.accountNotFound(accountId);

        const existing = await transactionRepository.findByReference(db, accountId, input.reference_id);
        if (existing) throw Errors.duplicateTransaction(input.reference_id, toTransactionDto(existing));

        const amount = BigInt(input.amount);
        const delta = input.type === 'credit' ? amount : -amount;

        const newBalance = await accountRepository.applyDelta(db, accountId, delta);
        if (newBalance === null) {
          // Row is locked, so this balance is exactly what the conditional UPDATE saw.
          throw Errors.insufficientBalance(toApiMoney(account.balance), input.amount);
        }

        return transactionRepository.insert(db, {
          accountId,
          type: input.type,
          amount,
          balanceAfter: newBalance,
          description: input.description,
          referenceId: input.reference_id,
        });
      });
      return toTransactionDto(row);
    } catch (err) {
      // Only reachable if the application-level duplicate check was bypassed (should not
      // happen under the row lock); the constraint still guarantees a single balance change.
      if (isUniqueViolation(err, UNIQUE_REFERENCE)) {
        const existing = await transactionRepository.findByReference(pool, accountId, input.reference_id);
        throw Errors.duplicateTransaction(input.reference_id, existing ? toTransactionDto(existing) : undefined);
      }
      if (isCheckViolation(err, BALANCE_MAX)) throw Errors.balanceLimitExceeded();
      throw err;
    }
  },

  async list(accountId: string, query: ListTransactionsQuery) {
    // One REPEATABLE READ snapshot so total_records and the page contents agree.
    return withTransaction(
      async (db) => {
        const account = await accountRepository.findById(db, accountId);
        if (!account) throw Errors.accountNotFound(accountId);

        const total = await transactionRepository.count(db, accountId, query.type);
        const rows = await transactionRepository.list(db, {
          accountId,
          type: query.type,
          limit: query.limit,
          offset: (query.page - 1) * query.limit,
        });

        return {
          data: rows.map(toTransactionDto),
          pagination: {
            page: query.page,
            limit: query.limit,
            total_records: total,
            total_pages: Math.ceil(total / query.limit),
          },
        };
      },
      { isolation: 'REPEATABLE READ', readOnly: true },
    );
  },
};
