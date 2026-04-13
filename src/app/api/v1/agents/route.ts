import { z } from 'zod';

import { withRoute, parseJsonBody } from '@/lib/http/route';
import { ok } from '@/lib/http/response';
import { createAgentService, listAgentsService } from '@/server/services/agent.service';

const avatarUrlSchema = z.string().min(1).optional();

const createAgentSchema = z.object({
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

export async function GET() {
  return withRoute(async () => {
    const rows = await listAgentsService();
    return ok(rows);
  });
}

export async function POST(request: Request) {
  return withRoute(async () => {
    const input = await parseJsonBody(request, createAgentSchema);
    const row = await createAgentService(input);
    return ok(row, 'created');
  });
}
