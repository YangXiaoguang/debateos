import { withRoute } from '@/lib/http/route';
import { ok } from '@/lib/http/response';
import { getDebateWorkspaceService } from '@/server/services/debate.service';

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  return withRoute(async () => {
    const { id } = await context.params;
    const snapshot = await getDebateWorkspaceService(id);
    return ok(snapshot);
  });
}
