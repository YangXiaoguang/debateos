import { z } from 'zod';

import { parseJsonBody, withRoute } from '@/lib/http/route';
import { ok } from '@/lib/http/response';
import { requireCurrentUser } from '@/server/auth/session.service';
import { createManagedModelService, listManagedModelsService } from '@/server/services/model.service';

const modelSchema = z.object({
  provider: z.string().min(1).max(50),
  transport: z.enum(['mock', 'openai', 'openai-compatible', 'anthropic']),
  modelName: z.string().min(1).max(120),
  displayName: z.string().min(1).max(120),
  baseUrl: z.string().url().optional().or(z.literal('')),
  apiKey: z.string().min(1).optional(),
  apiKeyEnvName: z.string().min(1).max(120).optional(),
  defaultUseCases: z.array(z.enum(['agent', 'judge'])).optional(),
  notes: z.string().max(2000).optional(),
  isActive: z.boolean().optional(),
  clearStoredApiKey: z.boolean().optional(),
});

export async function GET() {
  return withRoute(async () => {
    const viewer = await requireCurrentUser();
    const rows = await listManagedModelsService({ onlyActive: viewer.role !== 'admin' });
    return ok(rows);
  });
}

export async function POST(request: Request) {
  return withRoute(async () => {
    const input = await parseJsonBody(request, modelSchema);
    const row = await createManagedModelService({
      ...input,
      baseUrl: input.baseUrl || undefined,
    });
    return ok(row, 'created');
  });
}
