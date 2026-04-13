import 'server-only';

import { asc, eq, inArray } from 'drizzle-orm';

import { db } from '@/lib/db/client';
import { topicAttachments } from '@/lib/db/schema';

export async function createTopicAttachments(values: Array<typeof topicAttachments.$inferInsert>) {
  if (values.length === 0) {
    return [];
  }

  return db.insert(topicAttachments).values(values).returning();
}

export async function listTopicAttachmentsByTopicId(topicId: string) {
  return db.select().from(topicAttachments).where(eq(topicAttachments.topicId, topicId)).orderBy(asc(topicAttachments.createdAt));
}

export async function listTopicAttachmentsByTopicIds(topicIds: string[]) {
  if (topicIds.length === 0) {
    return [];
  }

  return db
    .select()
    .from(topicAttachments)
    .where(inArray(topicAttachments.topicId, topicIds))
    .orderBy(asc(topicAttachments.createdAt));
}
