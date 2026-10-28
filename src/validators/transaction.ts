import { z } from 'zod';
import { MAX_AMOUNT } from '../utils/money';

export const createTransactionSchema = z
  .object({
    type: z.enum(['credit', 'debit'], {
      errorMap: () => ({ message: "type must be either 'credit' or 'debit'" }),
    }),
    amount: z
      .number({ required_error: 'amount is required', invalid_type_error: 'amount must be a number' })
      .int('amount must be a whole number of minor units (e.g. paise)')
      .positive('amount must be greater than 0')
      .max(MAX_AMOUNT, `amount must be at most ${MAX_AMOUNT}`),
    description: z
      .string({ required_error: 'description is required', invalid_type_error: 'description must be a string' })
      .trim()
      .min(1, 'description must not be empty')
      .max(500, 'description must be at most 500 characters'),
    reference_id: z
      .string({ required_error: 'reference_id is required', invalid_type_error: 'reference_id must be a string' })
      .trim()
      .min(1, 'reference_id must not be empty')
      .max(100, 'reference_id must be at most 100 characters'),
  })
  .strict();

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;

const intParam = (name: string, fallback: number, min: number, max: number) =>
  z
    .string()
    .regex(/^\d+$/, `${name} must be a positive integer`)
    .transform(Number)
    .pipe(
      z
        .number()
        .min(min, `${name} must be at least ${min}`)
        .max(max, `${name} must be at most ${max}`),
    )
    .optional()
    .transform((value) => value ?? fallback);

export const MAX_PAGE_SIZE = 100;
export const DEFAULT_PAGE_SIZE = 20;

export const listTransactionsQuerySchema = z.object({
  type: z
    .enum(['credit', 'debit'], { errorMap: () => ({ message: "type must be either 'credit' or 'debit'" }) })
    .optional(),
  page: intParam('page', 1, 1, 1_000_000),
  limit: intParam('limit', DEFAULT_PAGE_SIZE, 1, MAX_PAGE_SIZE),
});

export type ListTransactionsQuery = z.infer<typeof listTransactionsQuerySchema>;
