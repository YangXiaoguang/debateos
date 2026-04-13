import { z } from 'zod';

import { parseJsonBody, withRoute } from '@/lib/http/route';
import { ok } from '@/lib/http/response';
import { createSessionForUser, persistSessionCookie, signUpWithPassword } from '@/server/auth/session.service';
import { mapUserProfile } from '@/server/services/view-mappers';

const signUpSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export async function POST(request: Request) {
  return withRoute(async () => {
    const input = await parseJsonBody(request, signUpSchema);
    const user = await signUpWithPassword(input);
    const session = await createSessionForUser(user.id);
    await persistSessionCookie(session.token, session.expiresAt);
    return ok(mapUserProfile(user), 'signed_up');
  });
}
