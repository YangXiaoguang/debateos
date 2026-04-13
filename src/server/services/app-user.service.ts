import 'server-only';

import { cache } from 'react';

import { invariant } from '@/lib/http/route';
import { createUser, findUserByEmail, findUserById } from '@/server/repositories/user.repository';

const DEMO_USER_EMAIL = process.env.DEMO_USER_EMAIL || 'demo@debateos.local';
const DEMO_USER_NAME = process.env.DEMO_USER_NAME || 'DebateOS Operator';

export const getOrCreateAppUser = cache(async () => {
  const existing = await findUserByEmail(DEMO_USER_EMAIL);

  if (existing) {
    return existing;
  }

  return createUser({
    email: DEMO_USER_EMAIL,
    name: DEMO_USER_NAME,
  });
});

export async function resolveAppUser(ownerUserId?: string) {
  if (!ownerUserId) {
    return getOrCreateAppUser();
  }

  const existing = await findUserById(ownerUserId);
  invariant(existing, 'USER_NOT_FOUND', 'Owner user not found.', 404);
  return existing;
}
