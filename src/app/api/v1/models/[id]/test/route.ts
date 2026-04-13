import { withRoute } from '@/lib/http/route';
import { ok } from '@/lib/http/response';
import { testManagedModelConnectionService } from '@/server/services/model.service';

export const runtime = 'nodejs';

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  return withRoute(async () => {
    const { id } = await context.params;
    const result = await testManagedModelConnectionService(id);
    return ok(result, 'tested');
  });
}
