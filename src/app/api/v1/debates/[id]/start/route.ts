import { withRoute } from '@/lib/http/route';
import { ok } from '@/lib/http/response';
import { startDebateService } from '@/server/services/debate.service';

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  return withRoute(async () => {
    const { id } = await context.params;
    const row = await startDebateService(id);
    return ok(row, 'started');
  });
}
