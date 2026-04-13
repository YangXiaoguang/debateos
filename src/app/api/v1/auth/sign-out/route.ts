import { withRoute } from '@/lib/http/route';
import { ok } from '@/lib/http/response';
import { destroyCurrentSession } from '@/server/auth/session.service';

export async function POST() {
  return withRoute(async () => {
    await destroyCurrentSession();
    return ok({ signedOut: true }, 'signed_out');
  });
}
