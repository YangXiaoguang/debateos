import { ZodType } from 'zod';

import { fail } from '@/lib/http/response';

export class AppError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function invariant(condition: unknown, code: string, message: string, status = 400, details?: unknown): asserts condition {
  if (!condition) {
    throw new AppError(code, status, message, details);
  }
}

export async function parseJsonBody<T>(request: Request, schema: ZodType<T>) {
  const body = await request.json().catch(() => {
    throw new AppError('INVALID_JSON', 400, 'Request body must be valid JSON.');
  });

  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    throw new AppError('INVALID_REQUEST', 400, firstIssue?.message || 'Request validation failed.', {
      message: firstIssue?.message,
      issues: parsed.error.issues,
    });
  }

  return parsed.data;
}

export async function withRoute(handler: () => Promise<Response>) {
  try {
    return await handler();
  } catch (error) {
    if (error instanceof AppError) {
      return fail(error.code, error.message, error.status, error.details);
    }

    const message = error instanceof Error ? error.message : 'Unexpected server error.';
    return fail('INTERNAL_SERVER_ERROR', message, 500);
  }
}
