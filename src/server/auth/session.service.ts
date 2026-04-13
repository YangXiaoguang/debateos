import 'server-only';

import type { Route } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { AppError, invariant } from '@/lib/http/route';
import { createAuthSession, deleteAuthSessionByTokenHash, deleteExpiredAuthSessions, findAuthSessionWithUser } from '@/server/repositories/auth.repository';
import { countAdminUsers, createUser, findUserByEmail, findUserById, findUsersByName, updateUser } from '@/server/repositories/user.repository';
import { generateSessionToken, hashPassword, hashSessionToken, verifyPassword } from '@/server/security/crypto';

const SESSION_COOKIE_NAME = 'debateos_session';
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 14;

function buildSessionExpiry() {
  return new Date(Date.now() + SESSION_DURATION_MS);
}

async function getCookieStore() {
  return cookies();
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizeIdentifier(identifier: string) {
  return identifier.trim();
}

export async function createSessionForUser(userId: string) {
  const token = generateSessionToken();
  const tokenHash = hashSessionToken(token);
  const expiresAt = buildSessionExpiry();

  await createAuthSession({
    userId,
    tokenHash,
    expiresAt,
  });

  return {
    token,
    expiresAt,
  };
}

export async function persistSessionCookie(token: string, expiresAt: Date) {
  const cookieStore = await getCookieStore();

  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt,
  });
}

export async function clearSessionCookie() {
  const cookieStore = await getCookieStore();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function signUpWithPassword(input: {
  email: string;
  password: string;
  name?: string;
}) {
  const email = normalizeEmail(input.email);
  invariant(email.length > 0, 'INVALID_EMAIL', 'Email is required.', 400);
  invariant(input.password.length >= 8, 'INVALID_PASSWORD', 'Password must be at least 8 characters.', 400);

  const existing = await findUserByEmail(email);
  invariant(!existing, 'EMAIL_IN_USE', 'This email is already registered.', 409);

  const adminCount = await countAdminUsers();
  const user = await createUser({
    email,
    name: input.name?.trim() || null,
    passwordHash: hashPassword(input.password),
    role: adminCount === 0 ? 'admin' : 'user',
  });

  return user;
}

export async function signInWithPassword(input: {
  identifier: string;
  password: string;
}) {
  const identifier = normalizeIdentifier(input.identifier);
  invariant(identifier.length > 0, 'INVALID_CREDENTIALS', '请输入邮箱或用户名。', 400);

  const user = identifier.includes('@')
    ? await findUserByEmail(normalizeEmail(identifier))
    : await (async () => {
        const matches = await findUsersByName(identifier, 2);
        invariant(matches.length <= 1, 'AMBIGUOUS_USERNAME', '检测到多个同名账号，请改用邮箱登录。', 409);
        return matches[0] ?? null;
      })();

  invariant(user, 'INVALID_CREDENTIALS', '邮箱或密码错误。', 401);
  invariant(user.passwordHash, 'PASSWORD_LOGIN_DISABLED', 'This account cannot sign in with a password.', 403);
  invariant(verifyPassword(input.password, user.passwordHash), 'INVALID_CREDENTIALS', '邮箱或密码错误。', 401);

  await updateUser(user.id, {
    updatedAt: new Date(),
  });

  return user;
}

export async function destroyCurrentSession() {
  const cookieStore = await getCookieStore();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (token) {
    await deleteAuthSessionByTokenHash(hashSessionToken(token));
  }

  await clearSessionCookie();
}

export async function getCurrentUser() {
  const cookieStore = await getCookieStore();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  await deleteExpiredAuthSessions();
  const record = await findAuthSessionWithUser(hashSessionToken(token));

  if (!record) {
    return null;
  }

  if (record.session.expiresAt.getTime() <= Date.now()) {
    await deleteAuthSessionByTokenHash(record.session.tokenHash);
    return null;
  }

  return record.user;
}

export async function requireCurrentUser() {
  const user = await getCurrentUser();
  invariant(user, 'UNAUTHORIZED', '请先登录后再继续。', 401);
  return user;
}

export async function requireAdminUser() {
  const user = await requireCurrentUser();
  invariant(user.role === 'admin', 'FORBIDDEN', 'Only admins can perform this action.', 403);
  return user;
}

export async function resolveViewer(userId: string) {
  const user = await findUserById(userId);
  invariant(user, 'USER_NOT_FOUND', 'User not found.', 404);
  return user;
}

export async function requirePageUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/sign-in' as Route);
  }

  return user;
}

export async function redirectIfSignedIn(target = '/') {
  const user = await getCurrentUser();
  if (user) {
    redirect(target as Route);
  }
}

export function ensureOwnerAccess(ownerUserId: string, viewerUserId: string) {
  if (ownerUserId !== viewerUserId) {
    throw new AppError('FORBIDDEN', 403, 'You do not have access to this resource.');
  }
}
