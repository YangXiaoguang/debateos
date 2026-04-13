import { z } from 'zod';

import { ok } from '@/lib/http/response';
import { parseJsonBody, withRoute } from '@/lib/http/route';
import { deleteTopicService, updateTopicService } from '@/server/services/topic.service';

const updateTopicSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().min(1),
  extraContext: z.string().optional(),
  mode: z.enum(['hybrid', 'knockout', 'score', 'synthesis']).optional(),
  maxRounds: z.number().int().min(1).max(10).optional(),
  outputRequirements: z.string().optional(),
  winnerRule: z.enum(['hybrid', 'last_active', 'judge_score', 'user_vote']).optional(),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  return withRoute(async () => {
    const { id } = await context.params;
    const input = await parseJsonBody(request, updateTopicSchema);
    const row = await updateTopicService(id, input);
    return ok(row);
  });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  return withRoute(async () => {
    const { id } = await context.params;
    const result = await deleteTopicService(id);
    return ok(result, 'deleted');
  });
}
