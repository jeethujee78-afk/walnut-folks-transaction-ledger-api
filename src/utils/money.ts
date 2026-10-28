/**
 * Money is handled as integer minor units (e.g. paise) end to end:
 * request JSON integer -> BigInt in services -> BIGINT in PostgreSQL -> JSON integer.
 * Floating point arithmetic is never used on amounts or balances.
 */
export const MAX_AMOUNT = 100_000_000_000; // per-transaction cap (matches DB CHECK)

const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);

/** Convert a BIGINT (returned by pg as string) to a JSON number, refusing unsafe values. */
export function toApiMoney(value: string | number | bigint): number {
  const n = BigInt(value);
  if (n < 0n || n > MAX_SAFE) {
    throw new Error('Monetary value is outside the safe integer range');
  }
  return Number(n);
}
