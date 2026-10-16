import type { z } from 'zod';
import { ApiError } from './errors';

export function parse<S extends z.ZodType>(schema: S, value: unknown): z.output<S> {
  const result = schema.safeParse(value ?? {});
  if (result.success) return result.data;
  const fields: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join('.') || '_';
    fields[key] ??= issue.message;
  }
  const first = result.error.issues[0];
  throw new ApiError('validation_failed', first ? first.message : 'Invalid request', { fields });
}
