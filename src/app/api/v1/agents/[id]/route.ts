import { z } from 'zod';

import { ok } from '@/lib/http/response';
import { parseJsonBody, withRoute } from '@/lib/http/route';
import { deleteAgentService, updateAgentService } from '@/server/services/agent.service';

const avatarUrlSchema = z.string().min(1).optional();

const updateAgentSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  avatarUrl: avatarUrlSchema,
  modelId: z.string().uuid(),
  systemPrompt: z.string().min(1),
  stylePrompt: z.string().optional(),
  stanceTags: z.array(z.string()).optional(),
  capabilities: z.record(z.string(), z.unknown()).optional(),
  temperature: z.string().optional(),
  maxTokens: z.number().int().positive().optional(),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  return withRoute(async () => {
    const { id } = await context.params;
    const input = await parseJsonBody(request, updateAgentSchema);
    const row = await updateAgentService(id, input);
    return ok(row);
  });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  return withRoute(async () => {
    const { id } = await context.params;
    const result = await deleteAgentService(id);
    return ok(result, 'deleted');
  });
}
