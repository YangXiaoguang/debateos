import 'server-only';

import { count, eq, sql } from 'drizzle-orm';

import { db } from '@/lib/db/client';
import { users } from '@/lib/db/schema';

export async function findUserById(id: string) {
  const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return row ?? null;
}

export async function findUserByEmail(email: string) {
  const [row] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return row ?? null;
}

export async function findUsersByName(name: string, limit = 2) {
  return db
    .select()
    .from(users)
    .where(sql`lower(${users.name}) = lower(${name})`)
    .limit(limit);
}

export async function createUser(values: typeof users.$inferInsert) {
  const [row] = await db.insert(users).values(values).returning();
  if (!row) {
    throw new Error('Failed to create user.');
  }
  return row;
}

export async function updateUser(id: string, values: Partial<typeof users.$inferInsert>) {
  const [row] = await db.update(users).set(values).where(eq(users.id, id)).returning();
  return row ?? null;
}

export async function countUsers() {
  const [row] = await db
    .select({
      value: count(users.id),
    })
    .from(users);

  return Number(row?.value ?? 0);
}

export async function countAdminUsers() {
  const [row] = await db
    .select({
      value: count(users.id),
    })
    .from(users)
    .where(eq(users.role, 'admin'));

  return Number(row?.value ?? 0);
}
