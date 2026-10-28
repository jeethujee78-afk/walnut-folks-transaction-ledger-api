export interface PgErrorLike {
  code: string;
  constraint?: string;
}

export function isPgError(err: unknown): err is PgErrorLike {
  return (
    typeof err === 'object' &&
    err !== null &&
    typeof (err as { code?: unknown }).code === 'string' &&
    /^[0-9A-Z]{5}$/.test((err as { code: string }).code)
  );
}

export const isUniqueViolation = (err: unknown, constraint: string): boolean =>
  isPgError(err) && err.code === '23505' && err.constraint === constraint;

export const isCheckViolation = (err: unknown, constraint: string): boolean =>
  isPgError(err) && err.code === '23514' && err.constraint === constraint;

const CONNECTION_CODES = new Set(['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNRESET']);

/** True when the database could not be reached (as opposed to a query failing). */
export function isDatabaseUnavailable(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const { code, message } = err as { code?: unknown; message?: unknown };
  if (typeof code === 'string') {
    if (CONNECTION_CODES.has(code) || code.startsWith('08') || code.startsWith('57P')) return true;
  }
  return typeof message === 'string' && message.includes('timeout exceeded when trying to connect');
}
