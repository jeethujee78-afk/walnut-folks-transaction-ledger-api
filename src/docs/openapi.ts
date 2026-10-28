const uuid = { type: 'string', format: 'uuid' };
const money = (description: string) => ({ type: 'integer', minimum: 0, description });

const errorResponse = (description: string, code: string) => ({
  description,
  content: {
    'application/json': {
      schema: { $ref: '#/components/schemas/Error' },
      example: { error: { code, message: description } },
    },
  },
});

const accountIdParam = {
  name: 'accountId',
  in: 'path',
  required: true,
  schema: uuid,
  description: 'Account identifier (UUID)',
};

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Transaction Ledger API',
    version: '1.0.0',
    description:
      'Accounts with credit/debit transactions, balances and history.\n\n' +
      '**Money** is expressed in integer minor units (e.g. paise): `amount: 5000` is 50.00. ' +
      'Fractional values are rejected.\n\n' +
      'Errors share one shape: `{ "error": { "code", "message", "details?" } }`.',
  },
  tags: [{ name: 'Accounts' }, { name: 'Transactions' }, { name: 'System' }],
  paths: {
    '/accounts': {
      post: {
        tags: ['Accounts'],
        summary: 'Create an account (balance always starts at 0)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateAccount' },
              example: { name: 'Asha Verma' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Account created',
            content: {
              'application/json': {
                schema: { type: 'object', properties: { data: { $ref: '#/components/schemas/Account' } } },
              },
            },
          },
          '400': errorResponse('Request validation failed', 'VALIDATION_ERROR'),
        },
      },
    },
    '/accounts/{accountId}/balance': {
      get: {
        tags: ['Accounts'],
        summary: 'Get the current balance',
        parameters: [accountIdParam],
        responses: {
          '200': {
            description: 'Current balance',
            content: {
              'application/json': {
                schema: { type: 'object', properties: { data: { $ref: '#/components/schemas/Balance' } } },
              },
            },
          },
          '400': errorResponse('accountId is not a valid UUID', 'VALIDATION_ERROR'),
          '404': errorResponse('Account not found', 'ACCOUNT_NOT_FOUND'),
        },
      },
    },
    '/accounts/{accountId}/transactions': {
      post: {
        tags: ['Transactions'],
        summary: 'Add a credit or debit transaction (atomic with the balance update)',
        parameters: [accountIdParam],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateTransaction' },
              example: { type: 'credit', amount: 5000, description: 'Salary', reference_id: 'pay-2026-10' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Transaction recorded and balance updated',
            content: {
              'application/json': {
                schema: { type: 'object', properties: { data: { $ref: '#/components/schemas/Transaction' } } },
              },
            },
          },
          '400': errorResponse('Request validation failed', 'VALIDATION_ERROR'),
          '404': errorResponse('Account not found', 'ACCOUNT_NOT_FOUND'),
          '409': errorResponse(
            "A transaction with this reference_id already exists for the account (no balance change; details.existing_transaction holds the original)",
            'DUPLICATE_TRANSACTION',
          ),
          '422': errorResponse('Insufficient balance for a debit (or credit above max balance)', 'INSUFFICIENT_BALANCE'),
        },
      },
      get: {
        tags: ['Transactions'],
        summary: 'List transactions, latest first, with filtering and pagination',
        parameters: [
          accountIdParam,
          { name: 'type', in: 'query', schema: { type: 'string', enum: ['credit', 'debit'] }, description: 'Filter by type; omit for both' },
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
        ],
        responses: {
          '200': {
            description: 'A page of transactions',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/TransactionPage' } },
            },
          },
          '400': errorResponse('Invalid accountId or query parameters', 'VALIDATION_ERROR'),
          '404': errorResponse('Account not found', 'ACCOUNT_NOT_FOUND'),
        },
      },
      put: { tags: ['Transactions'], summary: 'Not allowed (transactions are immutable)', responses: { '405': errorResponse('Immutable', 'TRANSACTIONS_IMMUTABLE') } },
      patch: { tags: ['Transactions'], summary: 'Not allowed (transactions are immutable)', responses: { '405': errorResponse('Immutable', 'TRANSACTIONS_IMMUTABLE') } },
      delete: { tags: ['Transactions'], summary: 'Not allowed (transactions are immutable)', responses: { '405': errorResponse('Immutable', 'TRANSACTIONS_IMMUTABLE') } },
    },
    '/health': {
      get: {
        tags: ['System'],
        summary: 'Liveness and database connectivity check',
        responses: { '200': { description: 'OK' }, '503': { description: 'Database unavailable' } },
      },
    },
  },
  components: {
    schemas: {
      CreateAccount: {
        type: 'object',
        required: ['name'],
        additionalProperties: false,
        properties: { name: { type: 'string', minLength: 1, maxLength: 100 } },
      },
      Account: {
        type: 'object',
        properties: {
          id: uuid,
          name: { type: 'string' },
          balance: money('Balance in minor units; always 0 on creation'),
          created_at: { type: 'string', format: 'date-time' },
        },
      },
      Balance: {
        type: 'object',
        properties: { account_id: uuid, balance: money('Balance in minor units') },
      },
      CreateTransaction: {
        type: 'object',
        required: ['type', 'amount', 'description', 'reference_id'],
        additionalProperties: false,
        properties: {
          type: { type: 'string', enum: ['credit', 'debit'] },
          amount: { type: 'integer', minimum: 1, maximum: 100000000000, description: 'Minor units' },
          description: { type: 'string', minLength: 1, maxLength: 500 },
          reference_id: { type: 'string', minLength: 1, maxLength: 100, description: 'Unique per account' },
        },
      },
      Transaction: {
        type: 'object',
        properties: {
          id: uuid,
          account_id: uuid,
          type: { type: 'string', enum: ['credit', 'debit'] },
          amount: money('Minor units'),
          balance_after: money('Account balance immediately after this transaction'),
          description: { type: 'string' },
          reference_id: { type: 'string' },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
      TransactionPage: {
        type: 'object',
        properties: {
          data: { type: 'array', items: { $ref: '#/components/schemas/Transaction' } },
          pagination: {
            type: 'object',
            properties: {
              page: { type: 'integer' },
              limit: { type: 'integer' },
              total_records: { type: 'integer' },
              total_pages: { type: 'integer' },
            },
          },
        },
      },
      Error: {
        type: 'object',
        properties: {
          error: {
            type: 'object',
            properties: {
              code: { type: 'string' },
              message: { type: 'string' },
              details: {},
            },
          },
        },
      },
    },
  },
};
