import { z } from 'zod';

// .strict() rejects unknown keys, so a client sending `balance` (or `id`, `created_at`)
// gets a 400 instead of having the value silently ignored.
export const createAccountSchema = z
  .object({
    name: z
      .string({ required_error: 'name is required', invalid_type_error: 'name must be a string' })
      .trim()
      .min(1, 'name must not be empty')
      .max(100, 'name must be at most 100 characters'),
  })
  .strict();
