import { relations } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const userRoleEnum = pgEnum('user_role', ['user', 'admin']);
export const agentStatusEnum = pgEnum('agent_status', ['active', 'archived', 'disabled']);
export const topicStatusEnum = pgEnum('topic_status', ['draft', 'ready', 'archived']);
export const sessionStatusEnum = pgEnum('session_status', ['draft', 'ready', 'running', 'paused', 'completed', 'aborted', 'failed']);
export const participantStateEnum = pgEnum('participant_state', ['pending', 'active', 'speaking', 'waiting', 'conceded', 'stopped', 'errored']);
export const roundPhaseEnum = pgEnum('round_phase', ['opening', 'critique', 'rebuttal', 'final', 'judging', 'closed']);
export const roundStatusEnum = pgEnum('round_status', ['pending', 'running', 'completed', 'failed']);
export const turnStatusEnum = pgEnum('turn_status', ['pending', 'streaming', 'completed', 'failed']);
export const topicModeEnum = pgEnum('topic_mode', ['hybrid', 'knockout', 'score', 'synthesis']);
export const winnerRuleEnum = pgEnum('winner_rule', ['hybrid', 'last_active', 'judge_score', 'user_vote']);
export const artifactTypeEnum = pgEnum('artifact_type', ['winner_report', 'judge_report', 'argument_map', 'session_summary', 'export_json', 'export_markdown']);
export const eventTypeEnum = pgEnum('event_type', [
  'TOPIC_CREATED',
  'AGENT_SELECTED',
  'DEBATE_STARTED',
  'ROUND_STARTED',
  'TURN_STARTED',
  'TURN_STREAM_DELTA',
  'TURN_COMPLETED',
  'AGENT_CONCEDED',
  'ROUND_COMPLETED',
  'SESSION_PAUSED',
  'SESSION_RESUMED',
  'SESSION_ABORTED',
  'JUDGE_SCORED',
  'WINNER_DECIDED',
  'SESSION_COMPLETED',
]);

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 255 }).notNull(),
  name: varchar('name', { length: 100 }),
  avatarUrl: text('avatar_url'),
  passwordHash: text('password_hash'),
  role: userRoleEnum('role').default('user').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (t) => ({
  emailUq: uniqueIndex('users_email_uq').on(t.email),
}));

export const authSessions = pgTable('auth_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: varchar('token_hash', { length: 255 }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (t) => ({
  tokenHashUq: uniqueIndex('auth_sessions_token_hash_uq').on(t.tokenHash),
  userIdx: index('auth_sessions_user_idx').on(t.userId),
}));

export const systemModels = pgTable('system_models', {
  id: uuid('id').defaultRandom().primaryKey(),
  provider: varchar('provider', { length: 50 }).notNull(),
  modelName: varchar('model_name', { length: 120 }).notNull(),
  displayName: varchar('display_name', { length: 120 }).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  config: jsonb('config').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
});

export const agents = pgTable('agents', {
  id: uuid('id').defaultRandom().primaryKey(),
  ownerUserId: uuid('owner_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  avatarUrl: text('avatar_url'),
  modelId: uuid('model_id').references(() => systemModels.id, { onDelete: 'set null' }),
  systemPrompt: text('system_prompt').notNull(),
  stylePrompt: text('style_prompt'),
  stanceTags: jsonb('stance_tags').$type<string[]>(),
  capabilities: jsonb('capabilities').$type<Record<string, unknown>>(),
  temperature: numeric('temperature', { precision: 3, scale: 2 }).default('0.70'),
  maxTokens: integer('max_tokens'),
  status: agentStatusEnum('status').default('active').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (t) => ({
  ownerIdx: index('agents_owner_idx').on(t.ownerUserId),
  statusIdx: index('agents_status_idx').on(t.status),
}));

export const agentVersions = pgTable('agent_versions', {
  id: uuid('id').defaultRandom().primaryKey(),
  agentId: uuid('agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
  versionNo: integer('version_no').notNull(),
  snapshot: jsonb('snapshot').$type<Record<string, unknown>>().notNull(),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (t) => ({
  uq: uniqueIndex('agent_versions_agent_version_uq').on(t.agentId, t.versionNo),
}));

export const topics = pgTable('topics', {
  id: uuid('id').defaultRandom().primaryKey(),
  ownerUserId: uuid('owner_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description').notNull(),
  extraContext: text('extra_context'),
  mode: topicModeEnum('mode').default('hybrid').notNull(),
  maxRounds: integer('max_rounds').default(3).notNull(),
  outputRequirements: text('output_requirements'),
  winnerRule: winnerRuleEnum('winner_rule').default('hybrid').notNull(),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  status: topicStatusEnum('status').default('draft').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
});

export const topicAttachments = pgTable('topic_attachments', {
  id: uuid('id').defaultRandom().primaryKey(),
  topicId: uuid('topic_id').notNull().references(() => topics.id, { onDelete: 'cascade' }),
  fileName: varchar('file_name', { length: 255 }).notNull(),
  fileType: varchar('file_type', { length: 100 }),
  fileSize: integer('file_size'),
  fileUrl: text('file_url').notNull(),
  extractedText: text('extracted_text'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (t) => ({
  topicIdx: index('topic_attachments_topic_idx').on(t.topicId),
}));

export const debateSessions = pgTable('debate_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  topicId: uuid('topic_id').notNull().references(() => topics.id, { onDelete: 'cascade' }),
  ownerUserId: uuid('owner_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  status: sessionStatusEnum('status').default('draft').notNull(),
  currentRoundNo: integer('current_round_no').default(0).notNull(),
  currentPhase: roundPhaseEnum('current_phase'),
  winnerAgentId: uuid('winner_agent_id').references(() => agents.id, { onDelete: 'set null' }),
  startedAt: timestamp('started_at', { withTimezone: true, mode: 'date' }),
  pausedAt: timestamp('paused_at', { withTimezone: true, mode: 'date' }),
  completedAt: timestamp('completed_at', { withTimezone: true, mode: 'date' }),
  abortedAt: timestamp('aborted_at', { withTimezone: true, mode: 'date' }),
  lastCheckpoint: jsonb('last_checkpoint').$type<Record<string, unknown>>(),
  summary: text('summary'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (t) => ({
  ownerIdx: index('debate_sessions_owner_idx').on(t.ownerUserId),
  statusIdx: index('debate_sessions_status_idx').on(t.status),
  topicIdx: index('debate_sessions_topic_idx').on(t.topicId),
}));

export const debateParticipants = pgTable('debate_participants', {
  id: uuid('id').defaultRandom().primaryKey(),
  sessionId: uuid('session_id').notNull().references(() => debateSessions.id, { onDelete: 'cascade' }),
  agentId: uuid('agent_id').notNull().references(() => agents.id, { onDelete: 'restrict' }),
  agentVersionId: uuid('agent_version_id').references(() => agentVersions.id, { onDelete: 'set null' }),
  seatOrder: integer('seat_order').notNull(),
  state: participantStateEnum('state').default('pending').notNull(),
  isRandomSelected: boolean('is_random_selected').default(false).notNull(),
  concedeReason: text('concede_reason'),
  totalScore: numeric('total_score', { precision: 6, scale: 2 }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (t) => ({
  uq: uniqueIndex('debate_participants_session_agent_uq').on(t.sessionId, t.agentId),
}));

export const debateRounds = pgTable('debate_rounds', {
  id: uuid('id').defaultRandom().primaryKey(),
  sessionId: uuid('session_id').notNull().references(() => debateSessions.id, { onDelete: 'cascade' }),
  roundNo: integer('round_no').notNull(),
  phase: roundPhaseEnum('phase').notNull(),
  status: roundStatusEnum('status').default('pending').notNull(),
  summary: text('summary'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (t) => ({
  uq: uniqueIndex('debate_rounds_session_round_phase_uq').on(t.sessionId, t.roundNo, t.phase),
}));

export const debateTurns = pgTable('debate_turns', {
  id: uuid('id').defaultRandom().primaryKey(),
  sessionId: uuid('session_id').notNull().references(() => debateSessions.id, { onDelete: 'cascade' }),
  roundId: uuid('round_id').notNull().references(() => debateRounds.id, { onDelete: 'cascade' }),
  participantId: uuid('participant_id').notNull().references(() => debateParticipants.id, { onDelete: 'cascade' }),
  turnIndex: integer('turn_index').notNull(),
  promptSnapshot: jsonb('prompt_snapshot').$type<Record<string, unknown>>(),
  inputContext: jsonb('input_context').$type<Record<string, unknown>>(),
  streamedText: text('streamed_text'),
  finalText: text('final_text'),
  outputMetadata: jsonb('output_metadata').$type<Record<string, unknown>>(),
  tokenInput: integer('token_input'),
  tokenOutput: integer('token_output'),
  latencyMs: integer('latency_ms'),
  isConceded: boolean('is_conceded').default(false).notNull(),
  status: turnStatusEnum('status').default('completed').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
});

export const debateEvents = pgTable('debate_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  sessionId: uuid('session_id').notNull().references(() => debateSessions.id, { onDelete: 'cascade' }),
  eventType: eventTypeEnum('event_type').notNull(),
  payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
});

export const judgeScores = pgTable('judge_scores', {
  id: uuid('id').defaultRandom().primaryKey(),
  sessionId: uuid('session_id').notNull().references(() => debateSessions.id, { onDelete: 'cascade' }),
  roundId: uuid('round_id').references(() => debateRounds.id, { onDelete: 'cascade' }),
  participantId: uuid('participant_id').notNull().references(() => debateParticipants.id, { onDelete: 'cascade' }),
  logicScore: numeric('logic_score', { precision: 5, scale: 2 }),
  critiqueScore: numeric('critique_score', { precision: 5, scale: 2 }),
  feasibilityScore: numeric('feasibility_score', { precision: 5, scale: 2 }),
  riskScore: numeric('risk_score', { precision: 5, scale: 2 }),
  alignmentScore: numeric('alignment_score', { precision: 5, scale: 2 }),
  totalScore: numeric('total_score', { precision: 6, scale: 2 }),
  explanation: text('explanation'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
});

export const messageFavorites = pgTable('message_favorites', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  turnId: uuid('turn_id').notNull().references(() => debateTurns.id, { onDelete: 'cascade' }),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (t) => ({
  uq: uniqueIndex('message_favorites_user_turn_uq').on(t.userId, t.turnId),
}));

export const sessionArtifacts = pgTable('session_artifacts', {
  id: uuid('id').defaultRandom().primaryKey(),
  sessionId: uuid('session_id').notNull().references(() => debateSessions.id, { onDelete: 'cascade' }),
  artifactType: artifactTypeEnum('artifact_type').notNull(),
  title: varchar('title', { length: 255 }),
  content: jsonb('content').$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  agents: many(agents),
  topics: many(topics),
  sessions: many(debateSessions),
  authSessions: many(authSessions),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type AuthSession = typeof authSessions.$inferSelect;
export type NewAuthSession = typeof authSessions.$inferInsert;
export type SystemModel = typeof systemModels.$inferSelect;
export type NewSystemModel = typeof systemModels.$inferInsert;
export type Agent = typeof agents.$inferSelect;
export type NewAgent = typeof agents.$inferInsert;
export type AgentVersion = typeof agentVersions.$inferSelect;
export type NewAgentVersion = typeof agentVersions.$inferInsert;
export type Topic = typeof topics.$inferSelect;
export type NewTopic = typeof topics.$inferInsert;
export type TopicAttachment = typeof topicAttachments.$inferSelect;
export type NewTopicAttachment = typeof topicAttachments.$inferInsert;
export type DebateSession = typeof debateSessions.$inferSelect;
export type NewDebateSession = typeof debateSessions.$inferInsert;
export type DebateParticipant = typeof debateParticipants.$inferSelect;
export type NewDebateParticipant = typeof debateParticipants.$inferInsert;
export type DebateRound = typeof debateRounds.$inferSelect;
export type NewDebateRound = typeof debateRounds.$inferInsert;
export type DebateTurn = typeof debateTurns.$inferSelect;
export type NewDebateTurn = typeof debateTurns.$inferInsert;
export type DebateEvent = typeof debateEvents.$inferSelect;
export type NewDebateEvent = typeof debateEvents.$inferInsert;
export type JudgeScore = typeof judgeScores.$inferSelect;
export type NewJudgeScore = typeof judgeScores.$inferInsert;
export type MessageFavorite = typeof messageFavorites.$inferSelect;
export type NewMessageFavorite = typeof messageFavorites.$inferInsert;
export type SessionArtifact = typeof sessionArtifacts.$inferSelect;
export type NewSessionArtifact = typeof sessionArtifacts.$inferInsert;
