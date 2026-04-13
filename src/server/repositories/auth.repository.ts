import 'server-only';

import { and, eq, lt } from 'drizzle-orm';

import { db } from '@/lib/db/client';
import { authSessions, users } from '@/lib/db/schema';

export async function createAuthSession(values: typeof authSessions.$inferInsert) {
  const [row] = await db.insert(authSessions).values(values).returning();
  if (!row) {
    throw new Error('Failed to create auth session.');
  }
  return row;
}

export async function findAuthSessionWithUser(tokenHash: string) {
  const [row] = await db
    .select({
      session: authSessions,
      user: users,
    })
    .from(authSessions)
    .innerJoin(users, eq(authSessions.userId, users.id))
    .where(eq(authSessions.tokenHash, tokenHash))
    .limit(1);

  return row ?? null;
}

export async function deleteAuthSessionByTokenHash(tokenHash: string) {
  await db.delete(authSessions).where(eq(authSessions.tokenHash, tokenHash));
}

export async function deleteExpiredAuthSessions(now = new Date()) {
  await db.delete(authSessions).where(lt(authSessions.expiresAt, now));
}

export async function deleteAuthSessionsByUserId(userId: string) {
  await db.delete(authSessions).where(eq(authSessions.userId, userId));
}

export async function touchAuthSession(id: string, values: Partial<typeof authSessions.$inferInsert>) {
  const [row] = await db.update(authSessions).set(values).where(eq(authSessions.id, id)).returning();
  return row ?? null;
}

export async function revokeAuthSession(id: string, userId: string) {
  await db.delete(authSessions).where(and(eq(authSessions.id, id), eq(authSessions.userId, userId)));
}
