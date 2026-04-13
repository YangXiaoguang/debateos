import 'server-only';

import type {
  Agent,
  SystemModel,
  DebateEvent,
  DebateParticipant,
  DebateRound,
  DebateSession,
  DebateTurn,
  JudgeScore,
  SessionArtifact,
  Topic,
  TopicAttachment,
  User,
} from '@/lib/db/schema';
import type {
  AgentListItem,
  AppUserProfile,
  DebateArtifactView,
  DebateBubble,
  DebateEventView,
  DebateJudgeScoreView,
  DebateParticipantView,
  DebateScoreHints,
  DebateSessionListItem,
  DebateStructured,
  DebateTurnPayload,
  DebateTurnView,
  TopicAttachmentView,
  TopicListItem,
} from '@/types/domain';

function toIsoString(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

function toNumber(value: string | number | null | undefined, fallback = 0) {
  if (value === null || value === undefined) return fallback;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function defaultBubble(agentName: string, phase: string, text: string): DebateBubble {
  return {
    title: `${agentName} · ${phase}`,
    excerpt: text.replace(/\s+/g, ' ').slice(0, 80) || `${agentName} 完成了一轮发言。`,
  };
}

function defaultStructured(): DebateStructured {
  const scoreHints: DebateScoreHints = {
    logic: 0,
    critique: 0,
    feasibility: 0,
    risk: 0,
    alignment: 0,
  };

  return {
    claims: [],
    attacks: [],
    concessions: [],
    questions: [],
    score_hints: scoreHints,
  };
}

export function mapUserProfile(user: User): AppUserProfile {
  return {
    id: user.id,
    email: user.email,
    name: user.name ?? null,
    avatarUrl: user.avatarUrl ?? null,
    role: user.role,
  };
}

function toNullableNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export function mapTopicAttachmentView(attachment: TopicAttachment): TopicAttachmentView {
  const metadata = (attachment.metadata ?? {}) as {
    extraction?: {
      method?: unknown;
      status?: unknown;
      summary?: unknown;
      error?: unknown;
      pageCount?: unknown;
      characterCount?: unknown;
      ocrConfidence?: unknown;
    };
  };
  const extraction = metadata.extraction ?? {};

  return {
    id: attachment.id,
    fileName: attachment.fileName,
    fileType: attachment.fileType ?? null,
    fileSize: attachment.fileSize ?? null,
    fileUrl: attachment.fileUrl,
    extractedText: attachment.extractedText ?? null,
    extractionMethod:
      extraction.method === 'plain_text' ||
      extraction.method === 'pdf_text' ||
      extraction.method === 'ocr_image' ||
      extraction.method === 'ocr_pdf'
        ? extraction.method
        : 'none',
    extractionStatus:
      extraction.status === 'ready' || extraction.status === 'partial' || extraction.status === 'failed' ? extraction.status : 'skipped',
    extractionSummary: typeof extraction.summary === 'string' ? extraction.summary : null,
    extractionError: typeof extraction.error === 'string' ? extraction.error : null,
    pageCount: toNullableNumber(extraction.pageCount),
    characterCount: toNullableNumber(extraction.characterCount),
    ocrConfidence: toNullableNumber(extraction.ocrConfidence),
    createdAt: attachment.createdAt.toISOString(),
  };
}

export function mapAgentListItem(agent: Agent, model?: Pick<SystemModel, 'id' | 'displayName'> | null): AgentListItem {
  return {
    id: agent.id,
    ownerUserId: agent.ownerUserId,
    name: agent.name,
    description: agent.description ?? null,
    avatarUrl: agent.avatarUrl ?? null,
    modelId: agent.modelId ?? null,
    modelDisplayName: model?.displayName ?? null,
    systemPrompt: agent.systemPrompt,
    stylePrompt: agent.stylePrompt ?? null,
    stanceTags: agent.stanceTags ?? [],
    capabilities: agent.capabilities ?? {},
    temperature: agent.temperature ? String(agent.temperature) : null,
    maxTokens: agent.maxTokens ?? null,
    status: agent.status,
    createdAt: agent.createdAt.toISOString(),
    updatedAt: agent.updatedAt.toISOString(),
  };
}

export function mapTopicListItem(topic: Topic, attachments: TopicAttachment[] = []): TopicListItem {
  return {
    id: topic.id,
    ownerUserId: topic.ownerUserId,
    title: topic.title,
    description: topic.description,
    extraContext: topic.extraContext ?? null,
    mode: topic.mode,
    maxRounds: topic.maxRounds,
    outputRequirements: topic.outputRequirements ?? null,
    winnerRule: topic.winnerRule,
    attachments: attachments.map(mapTopicAttachmentView),
    status: topic.status,
    createdAt: topic.createdAt.toISOString(),
    updatedAt: topic.updatedAt.toISOString(),
  };
}

export function mapSessionListItem(
  session: DebateSession,
  topic: Pick<Topic, 'id' | 'title' | 'description'>,
  participantCount = 0
): DebateSessionListItem {
  return {
    id: session.id,
    topicId: session.topicId,
    ownerUserId: session.ownerUserId,
    topicTitle: topic.title,
    topicDescription: topic.description,
    status: session.status,
    currentRoundNo: session.currentRoundNo,
    currentPhase: session.currentPhase,
    winnerAgentId: session.winnerAgentId ?? null,
    participantCount: toNumber(participantCount),
    startedAt: toIsoString(session.startedAt),
    pausedAt: toIsoString(session.pausedAt),
    completedAt: toIsoString(session.completedAt),
    abortedAt: toIsoString(session.abortedAt),
    summary: session.summary ?? null,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
  };
}

export function mapParticipantView(row: {
  participant: DebateParticipant;
  agent: Agent;
}): DebateParticipantView {
  return {
    id: row.participant.id,
    sessionId: row.participant.sessionId,
    agentId: row.participant.agentId,
    seatOrder: row.participant.seatOrder,
    state: row.participant.state,
    isRandomSelected: row.participant.isRandomSelected,
    concedeReason: row.participant.concedeReason ?? null,
    totalScore: row.participant.totalScore ? toNumber(row.participant.totalScore, 0) : null,
    createdAt: row.participant.createdAt.toISOString(),
    updatedAt: row.participant.updatedAt.toISOString(),
    agent: {
      id: row.agent.id,
      name: row.agent.name,
      description: row.agent.description ?? null,
      avatarUrl: row.agent.avatarUrl ?? null,
      stanceTags: row.agent.stanceTags ?? [],
      stylePrompt: row.agent.stylePrompt ?? null,
      status: row.agent.status,
    },
  };
}

export function mapTurnView(row: {
  turn: DebateTurn;
  round: DebateRound;
  participant: DebateParticipant;
  agent: Agent;
}): DebateTurnView {
  const metadata = (row.turn.outputMetadata ?? {}) as Partial<DebateTurnPayload>;
  const text = row.turn.finalText ?? row.turn.streamedText ?? '';
  const bubble = metadata.bubble ?? defaultBubble(row.agent.name, row.round.phase, text);
  const structured = metadata.structured ?? defaultStructured();

  return {
    id: row.turn.id,
    sessionId: row.turn.sessionId,
    roundId: row.turn.roundId,
    participantId: row.turn.participantId,
    turnIndex: row.turn.turnIndex,
    phase: row.round.phase === 'closed' ? 'judging' : row.round.phase,
    status: row.turn.status,
    promptSnapshot: row.turn.promptSnapshot ?? {},
    inputContext: row.turn.inputContext ?? {},
    bubble,
    summary:
      metadata.turn?.summary ??
      `${row.agent.name} 在 ${row.round.phase} 阶段围绕当前议题完成了一轮结构化发言。`,
    text,
    structured,
    stance: metadata.turn?.stance ?? 'neutral',
    latencyMs: row.turn.latencyMs ?? null,
    tokenInput: row.turn.tokenInput ?? null,
    tokenOutput: row.turn.tokenOutput ?? null,
    isConceded: row.turn.isConceded,
    createdAt: row.turn.createdAt.toISOString(),
    updatedAt: row.turn.updatedAt.toISOString(),
    agent: {
      id: row.agent.id,
      name: row.agent.name,
      avatarUrl: row.agent.avatarUrl ?? null,
    },
  };
}

export function mapJudgeScoreView(row: {
  score: JudgeScore;
  participant: DebateParticipant;
  agent: Agent;
}): DebateJudgeScoreView {
  return {
    participantId: row.participant.id,
    agent_name: row.agent.name,
    agent_id: row.agent.id,
    logic_score: toNumber(row.score.logicScore, 0),
    critique_score: toNumber(row.score.critiqueScore, 0),
    feasibility_score: toNumber(row.score.feasibilityScore, 0),
    risk_score: toNumber(row.score.riskScore, 0),
    alignment_score: toNumber(row.score.alignmentScore, 0),
    total_score: toNumber(row.score.totalScore, 0),
    strengths: [],
    weaknesses: [],
  };
}

export function mapArtifactView(artifact: SessionArtifact): DebateArtifactView {
  return {
    id: artifact.id,
    artifactType: artifact.artifactType,
    title: artifact.title ?? null,
    content: artifact.content,
    createdAt: artifact.createdAt.toISOString(),
  };
}

export function mapEventView(event: DebateEvent): DebateEventView {
  return {
    id: event.id,
    eventType: event.eventType,
    payload: event.payload,
    createdAt: event.createdAt.toISOString(),
  };
}
