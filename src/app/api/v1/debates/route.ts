import { z } from 'zod';

import { parseJsonBody, withRoute } from '@/lib/http/route';
import { ok } from '@/lib/http/response';
import { createDebateService, listDebatesService } from '@/server/services/debate.service';

const createDebateSchema = z.object({
  topicId: z.string().uuid(),
  agentIds: z.array(z.string().uuid()).min(2).max(4),
});

export async function GET() {
  return withRoute(async () => {
    const rows = await listDebatesService();
    return ok(rows);
  });
}

export async function POST(request: Request) {
  return withRoute(async () => {
    const input = await parseJsonBody(request, createDebateSchema);
    const row = await createDebateService(input);
    return ok(row, 'created');
  });
}
