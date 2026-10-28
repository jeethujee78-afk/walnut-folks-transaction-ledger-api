import type { Db } from '../db/transaction';

export type AccountRow = { id: string; name: string; balance: string; created_at: Date };

const COLUMNS = 'id, name, balance, created_at';

export const accountRepository = {
  async create(db: Db, name: string): Promise<AccountRow> {
    const { rows } = await db.query<AccountRow>(
      `INSERT INTO accounts (name) VALUES ($1) RETURNING ${COLUMNS}`,
      [name],
    );
    return rows[0];
  },

  async findById(db: Db, id: string): Promise<AccountRow | null> {
    const { rows } = await db.query<AccountRow>(`SELECT ${COLUMNS} FROM accounts WHERE id = $1`, [id]);
    return rows[0] ?? null;
  },

  /** Takes a row-level write lock; concurrent ledger operations on the account queue behind it. */
  async lockById(db: Db, id: string): Promise<AccountRow | null> {
    const { rows } = await db.query<AccountRow>(
      `SELECT ${COLUMNS} FROM accounts WHERE id = $1 FOR UPDATE`,
      [id],
    );
    return rows[0] ?? null;
  },

  /**
   * Conditional update: the balance only changes if the result stays >= 0, evaluated by the
   * database against the locked row. Returns the new balance, or null if it was rejected.
   */
  async applyDelta(db: Db, id: string, delta: bigint): Promise<string | null> {
    const { rows } = await db.query<{ balance: string }>(
      `UPDATE accounts
          SET balance = balance + $2::bigint
        WHERE id = $1 AND balance + $2::bigint >= 0
    RETURNING balance`,
      [id, delta.toString()],
    );
    return rows[0]?.balance ?? null;
  },
};
