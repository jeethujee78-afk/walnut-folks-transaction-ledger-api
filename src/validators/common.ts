import { z } from 'zod';
import { Errors } from '../errors/AppError';

/** Parses data with a Zod schema; throws a 400 VALIDATION_ERROR listing every problem. */
export function parse<T extends z.ZodTypeAny>(schema: T, data: unknown, rootField = 'body'): z.output<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw Errors.validation(
      result.error.issues.map((issue) => ({
        field: issue.code === 'unrecognized_keys' ? issue.keys.join(', ') : issue.path.join('.') || rootField,
        message: issue.message,
      })),
    );
  }
  return result.data;
}

export const accountIdSchema = z
  .string({ required_error: 'accountId is required' })
  .uuid('accountId must be a valid UUID');
