import 'server-only';

import { invariant } from '@/lib/http/route';
import { listTopicAttachmentsByTopicIds } from '@/server/repositories/attachment.repository';
import { countTopicDebateUsages, createTopic, deleteTopic, getTopicById, listTopics, updateTopic } from '@/server/repositories/topic.repository';
import { ensureOwnerAccess, requireCurrentUser } from '@/server/auth/session.service';
import { mapTopicListItem } from '@/server/services/view-mappers';

export async function createTopicService(input: {
  title: string;
  description: string;
  extraContext?: string;
  mode?: 'hybrid' | 'knockout' | 'score' | 'synthesis';
  maxRounds?: number;
  outputRequirements?: string;
  winnerRule?: 'hybrid' | 'last_active' | 'judge_score' | 'user_vote';
}) {
  const owner = await requireCurrentUser();
  const row = await createTopic({
    ownerUserId: owner.id,
    title: input.title,
    description: input.description,
    extraContext: input.extraContext,
    mode: input.mode ?? 'hybrid',
    maxRounds: input.maxRounds ?? 3,
    outputRequirements: input.outputRequirements,
    winnerRule: input.winnerRule ?? 'hybrid',
  });

  return mapTopicListItem(row);
}

export async function listTopicsService() {
  const owner = await requireCurrentUser();
  const rows = await listTopics(owner.id);
  const attachments = await listTopicAttachmentsByTopicIds(rows.map((row) => row.id));

  return rows.map((row) =>
    mapTopicListItem(
      row,
      attachments.filter((attachment) => attachment.topicId === row.id)
    )
  );
}

export async function updateTopicService(
  topicId: string,
  input: {
    title: string;
    description: string;
    extraContext?: string;
    mode?: 'hybrid' | 'knockout' | 'score' | 'synthesis';
    maxRounds?: number;
    outputRequirements?: string;
    winnerRule?: 'hybrid' | 'last_active' | 'judge_score' | 'user_vote';
  }
) {
  const owner = await requireCurrentUser();
  const existing = await getTopicById(topicId);
  invariant(existing, 'TOPIC_NOT_FOUND', 'Topic not found.', 404);
  ensureOwnerAccess(existing.ownerUserId, owner.id);

  const row = await updateTopic(topicId, {
    title: input.title,
    description: input.description,
    extraContext: input.extraContext,
    mode: input.mode ?? existing.mode,
    maxRounds: input.maxRounds ?? existing.maxRounds,
    outputRequirements: input.outputRequirements,
    winnerRule: input.winnerRule ?? existing.winnerRule,
  });

  const attachments = await listTopicAttachmentsByTopicIds([row.id]);
  return mapTopicListItem(row, attachments.filter((attachment) => attachment.topicId === row.id));
}

export async function deleteTopicService(topicId: string) {
  const owner = await requireCurrentUser();
  const existing = await getTopicById(topicId);
  invariant(existing, 'TOPIC_NOT_FOUND', 'Topic not found.', 404);
  ensureOwnerAccess(existing.ownerUserId, owner.id);

  const usageCount = await countTopicDebateUsages(topicId);
  invariant(
    usageCount === 0,
    'TOPIC_IN_USE',
    '这个 Topic 已经被历史辩论引用，当前不能删除。你可以保留它继续复用，避免影响历史记录。'
  );

  const deleted = await deleteTopic(topicId);
  invariant(deleted, 'TOPIC_DELETE_FAILED', 'Failed to delete topic.', 500);

  return {
    id: deleted.id,
    deleted: true,
  };
}
