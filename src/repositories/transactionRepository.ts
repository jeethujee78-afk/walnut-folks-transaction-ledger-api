import type { Db } from '../db/transaction';
import type { TransactionType } from '../types';

export type TransactionRow = {
  id: string;
  account_id: string;
  type: TransactionType;
  amount: string;
  balance_after: string;
  description: string;
  reference_id: string;
  created_at: Date;
};

export type NewTransaction = {
  accountId: string;
  type: TransactionType;
  amount: bigint;
  balanceAfter: string;
  description: string;
  referenceId: string;
};

const COLUMNS = 'id, account_id, type, amount, balance_after, description, reference_id, created_at';

function filter(accountId: string, type?: TransactionType) {
  const values: unknown[] = [accountId];
  let where = 'account_id = $1';
  if (type) {
    values.push(type);
    where += ` AND type = $${values.length}`;
  }
  return { where, values };
}

export const transactionRepository = {
  async insert(db: Db, tx: NewTransaction): Promise<TransactionRow> {
    const { rows } = await db.query<TransactionRow>(
      `INSERT INTO transactions (account_id, type, amount, balance_after, description, reference_id)
       VALUES ($1, $2, $3::bigint, $4::bigint, $5, $6)
       RETURNING ${COLUMNS}`,
      [tx.accountId, tx.type, tx.amount.toString(), tx.balanceAfter, tx.description, tx.referenceId],
    );
    return rows[0];
  },

  async findByReference(db: Db, accountId: string, referenceId: string): Promise<TransactionRow | null> {
    const { rows } = await db.query<TransactionRow>(
      `SELECT ${COLUMNS} FROM transactions WHERE account_id = $1 AND reference_id = $2`,
      [accountId, referenceId],
    );
    return rows[0] ?? null;
  },

  async count(db: Db, accountId: string, type?: TransactionType): Promise<number> {
    const { where, values } = filter(accountId, type);
    const { rows } = await db.query<{ total: string }>(
      `SELECT count(*)::bigint AS total FROM transactions WHERE ${where}`,
      values,
    );
    return Number(rows[0].total);
  },

  /** Latest first; seq breaks ties between rows with identical timestamps. */
  async list(
    db: Db,
    params: { accountId: string; type?: TransactionType; limit: number; offset: number },
  ): Promise<TransactionRow[]> {
    const { where, values } = filter(params.accountId, params.type);
    values.push(params.limit, params.offset);
    const { rows } = await db.query<TransactionRow>(
      `SELECT ${COLUMNS} FROM transactions
        WHERE ${where}
        ORDER BY created_at DESC, seq DESC
        LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values,
    );
    return rows;
  },
};
