import 'server-only';

import { count, desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { debateSessions, topics } from '@/lib/db/schema';

export async function listTopics(ownerUserId?: string) {
  if (ownerUserId) {
    return db.select().from(topics).where(eq(topics.ownerUserId, ownerUserId)).orderBy(desc(topics.createdAt));
  }

  return db.select().from(topics).orderBy(desc(topics.createdAt));
}

export async function createTopic(values: typeof topics.$inferInsert) {
  const [row] = await db.insert(topics).values(values).returning();
  if (!row) {
    throw new Error('Failed to create topic.');
  }
  return row;
}

export async function getTopicById(id: string) {
  const [row] = await db.select().from(topics).where(eq(topics.id, id)).limit(1);
  return row ?? null;
}

export async function updateTopic(id: string, values: Partial<typeof topics.$inferInsert>) {
  const [row] = await db
    .update(topics)
    .set({
      ...values,
      updatedAt: new Date(),
    })
    .where(eq(topics.id, id))
    .returning();

  if (!row) {
    throw new Error('Failed to update topic.');
  }

  return row;
}

export async function deleteTopic(id: string) {
  const [row] = await db.delete(topics).where(eq(topics.id, id)).returning();
  return row ?? null;
}

export async function countTopicDebateUsages(topicId: string) {
  const [row] = await db
    .select({ count: count() })
    .from(debateSessions)
    .where(eq(debateSessions.topicId, topicId));

  return Number(row?.count ?? 0);
}
