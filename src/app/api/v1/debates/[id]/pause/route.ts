import { withRoute } from '@/lib/http/route';
import { ok } from '@/lib/http/response';
import { pauseDebateService } from '@/server/services/debate.service';

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  return withRoute(async () => {
    const { id } = await context.params;
    const row = await pauseDebateService(id);
    return ok(row, 'paused');
  });
}
