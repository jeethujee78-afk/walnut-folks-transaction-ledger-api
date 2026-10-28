# API reference

Base URL: `http://localhost:3000`. JSON in, JSON out. Interactive docs: `/docs`. Machine-readable: `/openapi.json`.

**Money** is an integer in minor units (e.g. paise). Success bodies are `{ "data": ... }`.
Errors are always:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Request validation failed", "details": [ { "field": "amount", "message": "amount must be greater than 0" } ] } }
```

| Status | Codes |
| --- | --- |
| 400 | `VALIDATION_ERROR`, `INVALID_JSON` |
| 404 | `ACCOUNT_NOT_FOUND`, `ROUTE_NOT_FOUND` |
| 405 | `TRANSACTIONS_IMMUTABLE` |
| 409 | `DUPLICATE_TRANSACTION` |
| 413 | `PAYLOAD_TOO_LARGE` |
| 422 | `INSUFFICIENT_BALANCE`, `BALANCE_LIMIT_EXCEEDED` |
| 500 / 503 | `INTERNAL_ERROR`, `DATABASE_ERROR`, `DATABASE_UNAVAILABLE` (no internals are returned) |

## POST /accounts

Body: `{ "name": string (1-100) }`. Unknown fields (e.g. `balance`) are rejected with 400.

`201`
```json
{ "data": { "id": "6f1c...", "name": "Asha Verma", "balance": 0, "created_at": "2026-10-28T09:30:00.000Z" } }
```

## GET /accounts/:accountId/balance

`200` `{ "data": { "account_id": "6f1c...", "balance": 5000 } }`
`400` malformed id · `404` account not found.

## POST /accounts/:accountId/transactions

| Field | Rules |
| --- | --- |
| `type` | `"credit"` or `"debit"` |
| `amount` | integer, 1 to 100000000000 |
| `description` | string, 1-500 |
| `reference_id` | string, 1-100, unique per account |

`201`
```json
{ "data": { "id": "9a2e...", "account_id": "6f1c...", "type": "credit", "amount": 5000, "balance_after": 5000,
            "description": "Salary", "reference_id": "pay-001", "created_at": "2026-10-28T09:31:00.000Z" } }
```
- `400` validation · `404` account not found
- `409` duplicate `reference_id` for this account (nothing changes; original returned in `error.details.existing_transaction`)
- `422` `INSUFFICIENT_BALANCE`, with `details: { balance, requested_amount }`

## GET /accounts/:accountId/transactions

| Query | Rules |
| --- | --- |
| `type` | optional `credit` or `debit` |
| `page` | integer >= 1, default 1 |
| `limit` | integer 1-100, default 20 |

`200` (latest first)
```json
{ "data": [ { "id": "...", "account_id": "...", "type": "debit", "amount": 300, "balance_after": 4700,
              "description": "Rent", "reference_id": "rent-01", "created_at": "..." } ],
  "pagination": { "page": 1, "limit": 20, "total_records": 2, "total_pages": 1 } }
```
`400` invalid query or id · `404` account not found.

## Immutability

`PUT`, `PATCH`, `DELETE` on `/accounts/:accountId/transactions[/:transactionId]` return `405 TRANSACTIONS_IMMUTABLE`.

## GET /health

`200 { "status": "ok" }` when the database is reachable, otherwise `503`.
