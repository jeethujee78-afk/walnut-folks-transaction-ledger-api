# Transaction Ledger API

A backend API for a simple transaction ledger: create accounts, post credit/debit transactions,
read balances, and page through transaction history. Built for correctness first: integer money,
database-enforced invariants, row-level locking, and idempotent references.

Money transfer (the optional bonus) is **not implemented yet**; see [Known limitations](#known-limitations).

## Features

- Create accounts (balance always starts at 0; the client cannot set it)
- Credit / debit transactions applied atomically with the balance update
- Overdraft protection that holds under concurrent requests
- Per-account unique `reference_id` (duplicates never change the balance)
- Balance lookup
- History: type filter, `page`/`limit` pagination with totals, latest-first
- Immutable transactions (no edit/delete routes, plus a database trigger)
- Consistent JSON errors, Zod validation, OpenAPI/Swagger docs at `/docs`

## Technology stack

Node.js (>= 20.12), TypeScript, Express 4, PostgreSQL via `pg` (Supabase-compatible), Zod,
Vitest + Supertest, `swagger-ui-express`.

Data access uses `pg` with plain SQL and SQL migration files instead of an ORM. The correctness
of this project rests on a few precise statements (`SELECT ... FOR UPDATE`, a conditional
`UPDATE`, constraints, a trigger); writing them as SQL keeps them explicit and reviewable.

## Architecture

```
src/
  app.ts, server.ts      Express app factory / process entrypoint
  config/env.ts          Validated environment
  routes/                URL -> controller wiring
  controllers/           HTTP in/out: validate input, call a service, shape the response
  services/              Business rules and DB transactions
  repositories/          SQL only
  validators/            Zod schemas
  middleware/            Error handling, 404
  errors/                AppError + error catalogue
  db/                    Pool, withTransaction, migration runner
  docs/openapi.ts        OpenAPI document served at /docs
db/migrations/           Explicit SQL migrations
tests/                   Vitest + Supertest integration tests (real PostgreSQL)
docs/API.md              Endpoint reference with examples
ASSUMPTIONS.md           Assumptions and design decisions
```

## Database design

`accounts(id uuid PK, name, balance bigint, created_at)` and
`transactions(id uuid PK, seq identity, account_id FK, type, amount bigint, balance_after bigint, description, reference_id, created_at)`.

| Concern | Mechanism |
| --- | --- |
| No negative balance | `CHECK (balance >= 0)` + conditional `UPDATE ... WHERE balance + delta >= 0` |
| Unique reference per account | `UNIQUE (account_id, reference_id)` |
| Valid type / positive amount | `CHECK` constraints |
| Transactions belong to real accounts | `FOREIGN KEY ... ON DELETE RESTRICT` |
| Immutability | `BEFORE UPDATE OR DELETE` trigger that raises an exception |
| History performance | Indexes on `(account_id, created_at DESC, seq DESC)` and the same with `type` |

## Financial integrity decisions

- **Integer minor units.** `amount` and `balance` are integers in the smallest currency unit
  (e.g. paise: `5000` = 50.00). They are `BIGINT` in PostgreSQL and `BigInt` in the service layer;
  floating point is never used. Fractional or string amounts are rejected with 400.
  Per-transaction max is `100000000000`; balances are capped at 2^53-1 so JSON numbers stay exact.
- **Atomicity.** Every balance change runs in one database transaction (`withTransaction`):
  lock account, check duplicate, update balance, insert transaction. Any error rolls everything back.
- **Concurrency.** The account row is locked with `SELECT ... FOR UPDATE`, so operations on one account
  are serialized. The balance update is also conditional in SQL, and `CHECK (balance >= 0)` is the final
  guard. Two simultaneous debits of 80 and 50 against 100: one succeeds, one gets 422.
- **Idempotency.** Duplicates are detected under the lock (so concurrent duplicates queue and the second
  sees the first) and backed by the unique constraint. A duplicate returns **409** with the original
  transaction and changes nothing.
- **Consistent history.** `total_records` and the page contents are read in one `REPEATABLE READ`
  read-only snapshot.

## Setup


### Windows setup

If you're using Windows, create your environment file with the appropriate command.

**Command Prompt:**
```cmd
copy .env.example .env
```

**PowerShell:**
```powershell
Copy-Item .env.example .env
```

Then edit `.env` with your database connection details before running migrations.


Requires Node.js >= 20.12 and a PostgreSQL 13+ database. You do **not** need PostgreSQL installed
locally: a free Supabase project works.

```bash
npm install
cp .env.example .env     # then edit .env
```

### Environment variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Application database connection string |
| `DATABASE_SSL` | `true` for Supabase/hosted databases, `false` for local Postgres |
| `TEST_DATABASE_URL` | **Separate** database used only by the tests (they truncate tables) |
| `PORT` | HTTP port (default 3000) |
| `DB_POOL_MAX` | Max pooled connections (default 10) |

Supabase: copy the connection string from *Project Settings > Database*. Use the **Direct** or
**Session pooler** string (port 5432). Do not append `?sslmode=...`; use `DATABASE_SSL=true`.
The migration runner takes an advisory lock, which is not reliable through the transaction pooler (port 6543).
For the test database, create a second (disposable) Supabase project, or any other Postgres database.
`.env` is git-ignored; never commit credentials.

### Migrations

```bash
npm run migrate
```

### Run

```bash
npm run dev                          # development (auto-reload)
npm run build && npm run migrate:prod && npm start    # production
```

Swagger UI: http://localhost:3000/docs · OpenAPI JSON: http://localhost:3000/openapi.json · Health: `/health`

### Tests

```bash
npm test
```

Requires `TEST_DATABASE_URL` (different from `DATABASE_URL`). The suite applies migrations to the test database,
then truncates the ledger tables before every test. It refuses to run if `TEST_DATABASE_URL` is unset or
equal to `DATABASE_URL`. Type-check with `npm run typecheck`.

## Example requests

```bash
# Create an account
curl -s -X POST localhost:3000/accounts -H 'Content-Type: application/json' -d '{"name":"Asha Verma"}'

# Credit 5000 (50.00)
curl -s -X POST localhost:3000/accounts/$ID/transactions -H 'Content-Type: application/json' \
  -d '{"type":"credit","amount":5000,"description":"Salary","reference_id":"pay-001"}'

# Balance
curl -s localhost:3000/accounts/$ID/balance

# History: debits only, 10 per page, page 1
curl -s "localhost:3000/accounts/$ID/transactions?type=debit&page=1&limit=10"
```

More in [docs/API.md](docs/API.md).

## Known limitations

- **Money transfer (bonus) is not implemented yet.** Planned design: lock both accounts in id order,
  write a linked debit + credit pair in one database transaction.
- No authentication/authorization (out of scope for the assignment).
- Single currency, amounts in minor units; no currency field.
- Offset pagination: very deep pages are slower than keyset pagination.
- Duplicate detection is by `(account_id, reference_id)` only; a repeated reference with a different payload is also a 409.
