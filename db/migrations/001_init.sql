-- Transaction Ledger schema.
-- Money is stored as BIGINT minor units (e.g. paise). No floating point anywhere.

CREATE TABLE accounts (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        varchar(100) NOT NULL,
  balance     bigint      NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT accounts_name_not_blank       CHECK (length(btrim(name)) > 0),
  -- Last line of defence: a negative balance can never be committed.
  CONSTRAINT accounts_balance_non_negative CHECK (balance >= 0),
  -- Keeps balances exactly representable as JSON numbers (2^53 - 1).
  CONSTRAINT accounts_balance_max          CHECK (balance <= 9007199254740991)
);

CREATE TABLE transactions (
  id            uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Monotonic tie-breaker for stable latest-first ordering. Not exposed by the API.
  seq           bigint       GENERATED ALWAYS AS IDENTITY,
  account_id    uuid         NOT NULL REFERENCES accounts (id) ON DELETE RESTRICT,
  type          text         NOT NULL,
  amount        bigint       NOT NULL,
  balance_after bigint       NOT NULL,
  description   varchar(500) NOT NULL,
  reference_id  varchar(100) NOT NULL,
  -- clock_timestamp() (not now()) so the value reflects when the row was written
  -- while holding the account lock, keeping created_at consistent with ledger order.
  created_at    timestamptz  NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT transactions_type_valid          CHECK (type IN ('credit', 'debit')),
  CONSTRAINT transactions_amount_range        CHECK (amount > 0 AND amount <= 100000000000),
  CONSTRAINT transactions_balance_after_valid CHECK (balance_after >= 0),
  CONSTRAINT transactions_description_present CHECK (length(btrim(description)) > 0),
  CONSTRAINT transactions_reference_present   CHECK (length(btrim(reference_id)) > 0),
  -- Idempotency: one reference_id per account (the same value may exist on other accounts).
  CONSTRAINT transactions_account_reference_unique UNIQUE (account_id, reference_id)
);

-- Latest-first history, with and without the type filter.
CREATE INDEX transactions_account_history_idx
  ON transactions (account_id, created_at DESC, seq DESC);
CREATE INDEX transactions_account_type_history_idx
  ON transactions (account_id, type, created_at DESC, seq DESC);

-- Immutability enforced by the database itself, not only by the absence of API routes.
CREATE FUNCTION prevent_transaction_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'transactions are immutable: % is not allowed', TG_OP
    USING ERRCODE = 'integrity_constraint_violation';
END;
$$;

CREATE TRIGGER transactions_immutable
  BEFORE UPDATE OR DELETE ON transactions
  FOR EACH ROW EXECUTE FUNCTION prevent_transaction_mutation();
