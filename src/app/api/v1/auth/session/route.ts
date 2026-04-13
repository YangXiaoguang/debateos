import { withRoute } from '@/lib/http/route';
import { ok } from '@/lib/http/response';
import { getCurrentUser } from '@/server/auth/session.service';
import { mapUserProfile } from '@/server/services/view-mappers';

export async function GET() {
  return withRoute(async () => {
    const user = await getCurrentUser();
    return ok(user ? mapUserProfile(user) : null);
  });
}
