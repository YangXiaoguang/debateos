import 'server-only';

import type { DebateSessionListItem, DebateWorkspaceSnapshot } from '@/types/domain';
import { invariant } from '@/lib/http/route';
import { listTopicAttachmentsByTopicId } from '@/server/repositories/attachment.repository';
import { listAgentsByIds } from '@/server/repositories/agent.repository';
import {
  addParticipants,
  createDebateEvent,
  createDebateSession,
  getDebateSessionById,
  getDebateSessionTopicRow,
  getTurnById,
  listArtifactsBySession,
  listDebateSessions,
  listEventsBySession,
  listJudgeScoresBySession,
  listParticipantsBySession,
  listTurnsBySession,
  updateDebateSession,
  upsertMessageFavorite,
} from '@/server/repositories/debate.repository';
import { getTopicById } from '@/server/repositories/topic.repository';
import { ensureOwnerAccess, requireCurrentUser } from '@/server/auth/session.service';
import { findUserById } from '@/server/repositories/user.repository';
import { publishSessionEvent } from '@/server/runtime/session-broker';
import {
  mapArtifactView,
  mapEventView,
  mapJudgeScoreView,
  mapParticipantView,
  mapSessionListItem,
  mapTopicListItem,
  mapTurnView,
  mapUserProfile,
} from '@/server/services/view-mappers';

async function buildSessionListItem(id: string): Promise<DebateSessionListItem> {
  const row = await getDebateSessionTopicRow(id);
  invariant(row, 'DEBATE_NOT_FOUND', 'Debate session not found.', 404);
  const participants = await listParticipantsBySession(id);
  return mapSessionListItem(row.session, row.topic, participants.length);
}

export async function listDebatesService() {
  const viewer = await requireCurrentUser();
  const rows = await listDebateSessions(viewer.id);
  return rows.map((row) => mapSessionListItem(row.session, row.topic, Number(row.participantCount ?? 0)));
}

export async function createDebateService(input: {
  topicId: string;
  agentIds: string[];
}) {
  const owner = await requireCurrentUser();
  const uniqueAgentIds = [...new Set(input.agentIds)];
  invariant(uniqueAgentIds.length >= 2, 'INVALID_DEBATE', 'At least two unique agents are required.');
  invariant(uniqueAgentIds.length <= 4, 'INVALID_DEBATE', 'A debate can have at most four agents.');

  const [topic, agents] = await Promise.all([getTopicById(input.topicId), listAgentsByIds(uniqueAgentIds)]);
  invariant(topic, 'TOPIC_NOT_FOUND', 'Topic not found.', 404);
  invariant(agents.length === uniqueAgentIds.length, 'AGENT_NOT_FOUND', 'One or more selected agents do not exist.', 404);
  ensureOwnerAccess(topic.ownerUserId, owner.id);
  invariant(agents.every((agent) => agent.ownerUserId === owner.id), 'FORBIDDEN', 'You can only select your own agents.', 403);
  invariant(
    agents.every((agent) => Boolean(agent.modelId)),
    'AGENT_MODEL_REQUIRED',
    '所有参战 Agent 都必须先绑定一个模型后才能发起辩论。'
  );

  const session = await createDebateSession({
    ownerUserId: owner.id,
    topicId: topic.id,
    status: 'ready',
  });

  await addParticipants(
    uniqueAgentIds.map((agentId, index) => ({
      sessionId: session.id,
      agentId,
      seatOrder: index + 1,
      state: 'pending',
    }))
  );

  await createDebateEvent({
    sessionId: session.id,
    eventType: 'AGENT_SELECTED',
    payload: { agentIds: uniqueAgentIds, topicId: topic.id },
    createdBy: owner.id,
  });

  return buildSessionListItem(session.id);
}

function readCheckpointPhase(value: Record<string, unknown> | null) {
  const nextPhase = value?.nextPhase;
  return typeof nextPhase === 'string' ? nextPhase : 'opening';
}

function readCheckpointRound(value: Record<string, unknown> | null) {
  const roundNo = value?.roundNo;
  return typeof roundNo === 'number' && roundNo > 0 ? roundNo : 1;
}

export async function startDebateService(id: string, userId?: string) {
  const viewer = await requireCurrentUser();
  const session = await getDebateSessionById(id);
  invariant(session, 'DEBATE_NOT_FOUND', 'Debate session not found.', 404);
  ensureOwnerAccess(session.ownerUserId, viewer.id);
  invariant(['draft', 'ready'].includes(session.status), 'INVALID_STATE', 'Only draft or ready sessions can be started.', 409);

  const checkpoint = (session.lastCheckpoint ?? null) as Record<string, unknown> | null;
  await updateDebateSession(id, {
    status: 'running',
    startedAt: session.startedAt ?? new Date(),
    pausedAt: null,
    abortedAt: null,
    currentPhase: readCheckpointPhase(checkpoint) as typeof session.currentPhase,
    currentRoundNo: readCheckpointRound(checkpoint),
  });

  await createDebateEvent({
    sessionId: id,
    eventType: 'DEBATE_STARTED',
    payload: { phase: readCheckpointPhase(checkpoint) },
    createdBy: userId ?? session.ownerUserId,
  });

  return buildSessionListItem(id);
}

export async function pauseDebateService(id: string, userId?: string) {
  const viewer = await requireCurrentUser();
  const session = await getDebateSessionById(id);
  invariant(session, 'DEBATE_NOT_FOUND', 'Debate session not found.', 404);
  ensureOwnerAccess(session.ownerUserId, viewer.id);
  invariant(session.status === 'running', 'INVALID_STATE', 'Only running sessions can be paused.', 409);

  await updateDebateSession(id, {
    status: 'paused',
    pausedAt: new Date(),
  });

  await createDebateEvent({
    sessionId: id,
    eventType: 'SESSION_PAUSED',
    payload: {},
    createdBy: userId ?? session.ownerUserId,
  });

  const listItem = await buildSessionListItem(id);
  publishSessionEvent(id, 'SESSION_PAUSED', { session: listItem });
  return listItem;
}

export async function resumeDebateService(id: string, userId?: string) {
  const viewer = await requireCurrentUser();
  const session = await getDebateSessionById(id);
  invariant(session, 'DEBATE_NOT_FOUND', 'Debate session not found.', 404);
  ensureOwnerAccess(session.ownerUserId, viewer.id);
  invariant(session.status === 'paused', 'INVALID_STATE', 'Only paused sessions can be resumed.', 409);

  await updateDebateSession(id, {
    status: 'running',
    pausedAt: null,
  });

  await createDebateEvent({
    sessionId: id,
    eventType: 'SESSION_RESUMED',
    payload: {},
    createdBy: userId ?? session.ownerUserId,
  });

  return buildSessionListItem(id);
}

export async function abortDebateService(id: string, userId?: string) {
  const viewer = await requireCurrentUser();
  const session = await getDebateSessionById(id);
  invariant(session, 'DEBATE_NOT_FOUND', 'Debate session not found.', 404);
  ensureOwnerAccess(session.ownerUserId, viewer.id);
  invariant(!['completed', 'aborted'].includes(session.status), 'INVALID_STATE', 'Completed or aborted sessions cannot be aborted again.', 409);

  await updateDebateSession(id, {
    status: 'aborted',
    abortedAt: new Date(),
  });

  await createDebateEvent({
    sessionId: id,
    eventType: 'SESSION_ABORTED',
    payload: {},
    createdBy: userId ?? session.ownerUserId,
  });

  const listItem = await buildSessionListItem(id);
  publishSessionEvent(id, 'SESSION_ABORTED', { session: listItem });
  return listItem;
}

export async function getDebateWorkspaceService(id: string): Promise<DebateWorkspaceSnapshot> {
  const viewer = await requireCurrentUser();
  const row = await getDebateSessionTopicRow(id);
  invariant(row, 'DEBATE_NOT_FOUND', 'Debate session not found.', 404);
  ensureOwnerAccess(row.session.ownerUserId, viewer.id);

  const [owner, participants, turns, scores, artifacts, recentSessions, events, attachments] = await Promise.all([
    findUserById(row.session.ownerUserId),
    listParticipantsBySession(id),
    listTurnsBySession(id),
    listJudgeScoresBySession(id),
    listArtifactsBySession(id),
    listDebateSessions(row.session.ownerUserId),
    listEventsBySession(id),
    listTopicAttachmentsByTopicId(row.topic.id),
  ]);

  invariant(owner, 'USER_NOT_FOUND', 'Owner user not found.', 404);

  return {
    viewer: mapUserProfile(viewer),
    session: mapSessionListItem(row.session, row.topic, participants.length),
    topic: mapTopicListItem(row.topic, attachments),
    participants: participants.map(mapParticipantView),
    turns: turns.map(mapTurnView),
    scores: scores.map(mapJudgeScoreView),
    artifacts: artifacts.map(mapArtifactView),
    recentSessions: recentSessions.map((sessionRow) =>
      mapSessionListItem(sessionRow.session, sessionRow.topic, Number(sessionRow.participantCount ?? 0))
    ),
    events: events.map(mapEventView),
  };
}

export async function getDebateResultService(id: string) {
  return getDebateWorkspaceService(id);
}

export async function favoriteTurnService(input: {
  turnId: string;
  note?: string;
}) {
  const owner = await requireCurrentUser();
  const turn = await getTurnById(input.turnId);
  invariant(turn, 'TURN_NOT_FOUND', 'Turn not found.', 404);

  const session = await getDebateSessionById(turn.sessionId);
  invariant(session, 'DEBATE_NOT_FOUND', 'Debate session not found.', 404);
  ensureOwnerAccess(session.ownerUserId, owner.id);

  const favorite = await upsertMessageFavorite({
    userId: owner.id,
    turnId: input.turnId,
    note: input.note ?? null,
  });

  return {
    id: favorite.id,
    turnId: favorite.turnId,
    note: favorite.note ?? null,
    createdAt: favorite.createdAt.toISOString(),
  };
}
