import 'server-only';

import { and, asc, count, desc, eq } from 'drizzle-orm';

import { db } from '@/lib/db/client';
import {
  agents,
  debateEvents,
  debateParticipants,
  debateRounds,
  debateSessions,
  debateTurns,
  judgeScores,
  messageFavorites,
  sessionArtifacts,
  topics,
} from '@/lib/db/schema';

export async function createDebateSession(values: typeof debateSessions.$inferInsert) {
  const [row] = await db.insert(debateSessions).values(values).returning();
  if (!row) {
    throw new Error('Failed to create debate session.');
  }
  return row;
}

export async function getDebateSessionById(id: string) {
  const [row] = await db.select().from(debateSessions).where(eq(debateSessions.id, id)).limit(1);
  return row ?? null;
}

export async function getDebateSessionTopicRow(id: string) {
  const [row] = await db
    .select({
      session: debateSessions,
      topic: topics,
    })
    .from(debateSessions)
    .innerJoin(topics, eq(debateSessions.topicId, topics.id))
    .where(eq(debateSessions.id, id))
    .limit(1);

  return row ?? null;
}

export async function addParticipants(values: Array<typeof debateParticipants.$inferInsert>) {
  return db.insert(debateParticipants).values(values).returning();
}

export async function listParticipantsBySession(sessionId: string) {
  return db
    .select({
      participant: debateParticipants,
      agent: agents,
    })
    .from(debateParticipants)
    .innerJoin(agents, eq(debateParticipants.agentId, agents.id))
    .where(eq(debateParticipants.sessionId, sessionId))
    .orderBy(asc(debateParticipants.seatOrder));
}

export async function listDebateSessions(ownerUserId: string) {
  return db
    .select({
      session: debateSessions,
      topic: topics,
      participantCount: count(debateParticipants.id),
    })
    .from(debateSessions)
    .innerJoin(topics, eq(debateSessions.topicId, topics.id))
    .leftJoin(debateParticipants, eq(debateParticipants.sessionId, debateSessions.id))
    .where(eq(debateSessions.ownerUserId, ownerUserId))
    .groupBy(debateSessions.id, topics.id)
    .orderBy(desc(debateSessions.updatedAt));
}

export async function updateDebateSession(id: string, values: Partial<typeof debateSessions.$inferInsert>) {
  const [row] = await db.update(debateSessions).set(values).where(eq(debateSessions.id, id)).returning();
  return row ?? null;
}

export async function getRoundBySessionPhase(sessionId: string, roundNo: number, phase: typeof debateRounds.$inferSelect.phase) {
  const [row] = await db
    .select()
    .from(debateRounds)
    .where(and(eq(debateRounds.sessionId, sessionId), eq(debateRounds.roundNo, roundNo), eq(debateRounds.phase, phase)))
    .limit(1);

  return row ?? null;
}

export async function listRoundsBySession(sessionId: string) {
  return db.select().from(debateRounds).where(eq(debateRounds.sessionId, sessionId)).orderBy(asc(debateRounds.roundNo), asc(debateRounds.createdAt));
}

export async function createRound(values: typeof debateRounds.$inferInsert) {
  const [row] = await db.insert(debateRounds).values(values).returning();
  if (!row) {
    throw new Error('Failed to create debate round.');
  }
  return row;
}

export async function updateRound(id: string, values: Partial<typeof debateRounds.$inferInsert>) {
  const [row] = await db.update(debateRounds).set(values).where(eq(debateRounds.id, id)).returning();
  return row ?? null;
}

export async function createTurn(values: typeof debateTurns.$inferInsert) {
  const [row] = await db.insert(debateTurns).values(values).returning();
  if (!row) {
    throw new Error('Failed to create debate turn.');
  }
  return row;
}

export async function updateTurn(id: string, values: Partial<typeof debateTurns.$inferInsert>) {
  const [row] = await db.update(debateTurns).set(values).where(eq(debateTurns.id, id)).returning();
  return row ?? null;
}

export async function listTurnsBySession(sessionId: string) {
  return db
    .select({
      turn: debateTurns,
      round: debateRounds,
      participant: debateParticipants,
      agent: agents,
    })
    .from(debateTurns)
    .innerJoin(debateRounds, eq(debateTurns.roundId, debateRounds.id))
    .innerJoin(debateParticipants, eq(debateTurns.participantId, debateParticipants.id))
    .innerJoin(agents, eq(debateParticipants.agentId, agents.id))
    .where(eq(debateTurns.sessionId, sessionId))
    .orderBy(asc(debateTurns.turnIndex), asc(debateTurns.createdAt));
}

export async function getTurnById(id: string) {
  const [row] = await db.select().from(debateTurns).where(eq(debateTurns.id, id)).limit(1);
  return row ?? null;
}

export async function countTurnsBySession(sessionId: string) {
  const [row] = await db
    .select({
      value: count(debateTurns.id),
    })
    .from(debateTurns)
    .where(eq(debateTurns.sessionId, sessionId));

  return Number(row?.value ?? 0);
}

export async function createDebateEvent(values: typeof debateEvents.$inferInsert) {
  const [row] = await db.insert(debateEvents).values(values).returning();
  if (!row) {
    throw new Error('Failed to create debate event.');
  }
  return row;
}

export async function listEventsBySession(sessionId: string) {
  return db.select().from(debateEvents).where(eq(debateEvents.sessionId, sessionId)).orderBy(asc(debateEvents.createdAt));
}

export async function updateParticipant(id: string, values: Partial<typeof debateParticipants.$inferInsert>) {
  const [row] = await db.update(debateParticipants).set(values).where(eq(debateParticipants.id, id)).returning();
  return row ?? null;
}

export async function replaceJudgeScores(sessionId: string, values: Array<typeof judgeScores.$inferInsert>) {
  await db.delete(judgeScores).where(eq(judgeScores.sessionId, sessionId));
  if (values.length === 0) return [];
  return db.insert(judgeScores).values(values).returning();
}

export async function listJudgeScoresBySession(sessionId: string) {
  return db
    .select({
      score: judgeScores,
      participant: debateParticipants,
      agent: agents,
    })
    .from(judgeScores)
    .innerJoin(debateParticipants, eq(judgeScores.participantId, debateParticipants.id))
    .innerJoin(agents, eq(debateParticipants.agentId, agents.id))
    .where(eq(judgeScores.sessionId, sessionId))
    .orderBy(desc(judgeScores.createdAt));
}

export async function replaceSessionArtifacts(sessionId: string, values: Array<typeof sessionArtifacts.$inferInsert>) {
  await db.delete(sessionArtifacts).where(eq(sessionArtifacts.sessionId, sessionId));
  if (values.length === 0) return [];
  return db.insert(sessionArtifacts).values(values).returning();
}

export async function listArtifactsBySession(sessionId: string) {
  return db.select().from(sessionArtifacts).where(eq(sessionArtifacts.sessionId, sessionId)).orderBy(desc(sessionArtifacts.createdAt));
}

export async function upsertMessageFavorite(values: typeof messageFavorites.$inferInsert) {
  const [row] = await db
    .insert(messageFavorites)
    .values(values)
    .onConflictDoUpdate({
      target: [messageFavorites.userId, messageFavorites.turnId],
      set: {
        note: values.note ?? null,
      },
    })
    .returning();

  if (!row) {
    throw new Error('Failed to favorite turn.');
  }

  return row;
}
