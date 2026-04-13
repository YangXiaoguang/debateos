import { z } from 'zod';

import { parseJsonBody, withRoute } from '@/lib/http/route';
import { ok } from '@/lib/http/response';
import { updateManagedModelService } from '@/server/services/model.service';

const updateModelSchema = z.object({
  provider: z.string().min(1).max(50).optional(),
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

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  return withRoute(async () => {
    const { id } = await context.params;
    const input = await parseJsonBody(request, updateModelSchema);
    const row = await updateManagedModelService(id, {
      ...input,
      baseUrl: input.baseUrl || undefined,
    });
    return ok(row, 'updated');
  });
}
