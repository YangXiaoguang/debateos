import { z } from 'zod';

import { parseJsonBody, withRoute } from '@/lib/http/route';
import { ok } from '@/lib/http/response';
import { createSessionForUser, persistSessionCookie, signInWithPassword } from '@/server/auth/session.service';
import { mapUserProfile } from '@/server/services/view-mappers';

const signInSchema = z.object({
  identifier: z.string().min(1, '请输入邮箱或用户名。').max(255),
  password: z.string().min(8, '密码至少需要 8 位。').max(128),
});

export async function POST(request: Request) {
  return withRoute(async () => {
    const input = await parseJsonBody(request, signInSchema);
    const user = await signInWithPassword(input);
    const session = await createSessionForUser(user.id);
    await persistSessionCookie(session.token, session.expiresAt);
    return ok(mapUserProfile(user), 'signed_in');
  });
}
