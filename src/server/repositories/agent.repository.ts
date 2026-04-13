import 'server-only';

import { count, desc, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { agents, debateParticipants } from '@/lib/db/schema';

export async function listAgents(ownerUserId?: string) {
  if (ownerUserId) {
    return db.select().from(agents).where(eq(agents.ownerUserId, ownerUserId)).orderBy(desc(agents.createdAt));
  }

  return db.select().from(agents).orderBy(desc(agents.createdAt));
}

export async function createAgent(values: typeof agents.$inferInsert) {
  const [row] = await db.insert(agents).values(values).returning();
  if (!row) {
    throw new Error('Failed to create agent.');
  }
  return row;
}

export async function getAgentById(id: string) {
  const [row] = await db.select().from(agents).where(eq(agents.id, id)).limit(1);
  return row ?? null;
}

export async function updateAgent(id: string, values: Partial<typeof agents.$inferInsert>) {
  const [row] = await db
    .update(agents)
    .set({
      ...values,
      updatedAt: new Date(),
    })
    .where(eq(agents.id, id))
    .returning();

  if (!row) {
    throw new Error('Failed to update agent.');
  }

  return row;
}

export async function deleteAgent(id: string) {
  const [row] = await db.delete(agents).where(eq(agents.id, id)).returning();
  return row ?? null;
}

export async function listAgentsByIds(ids: string[]) {
  if (ids.length === 0) {
    return [];
  }

  return db.select().from(agents).where(inArray(agents.id, ids));
}

export async function countAgentDebateUsages(agentId: string) {
  const [row] = await db
    .select({ count: count() })
    .from(debateParticipants)
    .where(eq(debateParticipants.agentId, agentId));

  return Number(row?.count ?? 0);
}
