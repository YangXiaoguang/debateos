import 'server-only';

import { desc, eq } from 'drizzle-orm';

import { db } from '@/lib/db/client';
import { systemModels } from '@/lib/db/schema';

export async function listSystemModels(options?: { onlyActive?: boolean }) {
  const query = db.select().from(systemModels);

  if (options?.onlyActive) {
    return query.where(eq(systemModels.isActive, true)).orderBy(desc(systemModels.updatedAt));
  }

  return query.orderBy(desc(systemModels.updatedAt));
}

export async function getSystemModelById(id: string) {
  const [row] = await db.select().from(systemModels).where(eq(systemModels.id, id)).limit(1);
  return row ?? null;
}

export async function createSystemModel(values: typeof systemModels.$inferInsert) {
  const [row] = await db.insert(systemModels).values(values).returning();
  if (!row) {
    throw new Error('Failed to create system model.');
  }
  return row;
}

export async function updateSystemModel(id: string, values: Partial<typeof systemModels.$inferInsert>) {
  const [row] = await db.update(systemModels).set(values).where(eq(systemModels.id, id)).returning();
  return row ?? null;
}
