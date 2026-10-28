export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const Errors = {
  validation: (details: unknown) =>
    new AppError(400, 'VALIDATION_ERROR', 'Request validation failed', details),
  accountNotFound: (accountId: string) =>
    new AppError(404, 'ACCOUNT_NOT_FOUND', `Account ${accountId} was not found`),
  insufficientBalance: (balance: number, requested: number) =>
    new AppError(422, 'INSUFFICIENT_BALANCE', 'Insufficient balance for this debit', {
      balance,
      requested_amount: requested,
    }),
  duplicateTransaction: (referenceId: string, existing?: unknown) =>
    new AppError(
      409,
      'DUPLICATE_TRANSACTION',
      `A transaction with reference_id '${referenceId}' already exists for this account`,
      existing ? { existing_transaction: existing } : undefined,
    ),
  balanceLimitExceeded: () =>
    new AppError(422, 'BALANCE_LIMIT_EXCEEDED', 'Credit would exceed the maximum supported balance'),
  transactionsImmutable: () =>
    new AppError(405, 'TRANSACTIONS_IMMUTABLE', 'Transactions are immutable and cannot be modified or deleted'),
  routeNotFound: (method: string, path: string) =>
    new AppError(404, 'ROUTE_NOT_FOUND', `Route ${method} ${path} does not exist`),
};
