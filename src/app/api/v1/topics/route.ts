import { z } from 'zod';

import { parseJsonBody, withRoute } from '@/lib/http/route';
import { ok } from '@/lib/http/response';
import { createTopicService, listTopicsService } from '@/server/services/topic.service';

const createTopicSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().min(1),
  extraContext: z.string().optional(),
  mode: z.enum(['hybrid', 'knockout', 'score', 'synthesis']).optional(),
  maxRounds: z.number().int().min(1).max(10).optional(),
  outputRequirements: z.string().optional(),
  winnerRule: z.enum(['hybrid', 'last_active', 'judge_score', 'user_vote']).optional(),
});

export async function GET() {
  return withRoute(async () => {
    const rows = await listTopicsService();
    return ok(rows);
  });
}

export async function POST(request: Request) {
  return withRoute(async () => {
    const input = await parseJsonBody(request, createTopicSchema);
    const row = await createTopicService(input);
    return ok(row, 'created');
  });
}
