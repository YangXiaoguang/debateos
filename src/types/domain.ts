export const DEBATE_PHASE_SEQUENCE = ['opening', 'critique', 'rebuttal', 'final'] as const;

export type DebatePhase = (typeof DEBATE_PHASE_SEQUENCE)[number] | 'judging' | 'closed';
export type DebateSessionStatus = 'draft' | 'ready' | 'running' | 'paused' | 'completed' | 'aborted' | 'failed';
export type ParticipantState = 'pending' | 'active' | 'speaking' | 'waiting' | 'conceded' | 'stopped' | 'errored';
export type TopicMode = 'hybrid' | 'knockout' | 'score' | 'synthesis';
export type WinnerRule = 'hybrid' | 'last_active' | 'judge_score' | 'user_vote';
export type ModelTransport = 'mock' | 'openai' | 'openai-compatible' | 'anthropic';
export type ModelUseCase = 'agent' | 'judge';
export type ModelCredentialStatus = 'not_required' | 'stored' | 'environment' | 'missing';
export type AttachmentExtractionMethod = 'none' | 'plain_text' | 'pdf_text' | 'ocr_image' | 'ocr_pdf';
export type AttachmentExtractionStatus = 'ready' | 'partial' | 'failed' | 'skipped';
export type EventType =
  | 'TOPIC_CREATED'
  | 'AGENT_SELECTED'
  | 'DEBATE_STARTED'
  | 'ROUND_STARTED'
  | 'TURN_STARTED'
  | 'TURN_STREAM_DELTA'
  | 'TURN_COMPLETED'
  | 'AGENT_CONCEDED'
  | 'ROUND_COMPLETED'
  | 'SESSION_PAUSED'
  | 'SESSION_RESUMED'
  | 'SESSION_ABORTED'
  | 'JUDGE_SCORED'
  | 'WINNER_DECIDED'
  | 'SESSION_COMPLETED';

export type AgentCapabilityFlags = {
  canUseFiles?: boolean;
  canUseWeb?: boolean;
  canConcede?: boolean;
};

export type DebateScoreHints = {
  logic: number;
  critique: number;
  feasibility: number;
  risk: number;
  alignment: number;
};

export type DebateBubble = {
  title: string;
  excerpt: string;
};

export type DebateStructured = {
  claims: Array<{ id?: string; text: string; type?: string; confidence?: string }>;
  attacks: Array<{ target_agent?: string; target_claim_id?: string; type?: string; text: string; severity?: string }>;
  concessions: Array<{ text: string; impact?: string }>;
  questions: Array<{ text: string }>;
  score_hints: DebateScoreHints;
};

export type DebateTurnPayload = {
  bubble: DebateBubble;
  turn: {
    phase: Exclude<DebatePhase, 'judging' | 'closed'>;
    stance: 'support' | 'oppose' | 'mixed' | 'neutral';
    summary: string;
    full_markdown: string;
  };
  structured: DebateStructured;
  control: {
    concede: boolean;
    stop: boolean;
    needs_more_context: boolean;
  };
};

export type DebateJudgeBreakdown = {
  agent_name: string;
  agent_id: string;
  logic_score: number;
  critique_score: number;
  feasibility_score: number;
  risk_score: number;
  alignment_score: number;
  total_score: number;
  responsiveness_score?: number;
  repetition_penalty?: number;
  penalties?: Array<{ reason: string; value: number }>;
  evidence_notes?: string[];
  decisive_turn_ids?: string[];
  strengths: string[];
  weaknesses: string[];
};

export type DebateJudgePayload = {
  winner_agent_name: string;
  winner_agent_id: string;
  overall_summary: string;
  score_breakdown: DebateJudgeBreakdown[];
  decisive_reasons: string[];
  final_recommendation_markdown: string;
};

export type WinnerSummaryPayload = {
  bubble: DebateBubble;
  winner_card: {
    agent_name: string;
    headline: string;
    why_win: string[];
    key_points: string[];
  };
  detail_panel: {
    summary_markdown: string;
    recommended_next_actions: string[];
  };
};

export type SessionCheckpoint = {
  nextPhase: DebatePhase | null;
  nextParticipantIndex: number;
  roundNo: number;
  completedPhases: DebatePhase[];
  processedTurnCount: number;
};

export type AppUserProfile = {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  role: 'user' | 'admin';
};

export type ManagedModelView = {
  id: string;
  provider: string;
  transport: ModelTransport;
  modelName: string;
  displayName: string;
  baseUrl: string | null;
  apiKeyEnvName: string | null;
  hasStoredApiKey: boolean;
  credentialStatus: ModelCredentialStatus;
  isActive: boolean;
  defaultUseCases: ModelUseCase[];
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TopicAttachmentView = {
  id: string;
  fileName: string;
  fileType: string | null;
  fileSize: number | null;
  fileUrl: string;
  extractedText: string | null;
  extractionMethod: AttachmentExtractionMethod;
  extractionStatus: AttachmentExtractionStatus;
  extractionSummary: string | null;
  extractionError: string | null;
  pageCount: number | null;
  characterCount: number | null;
  ocrConfidence: number | null;
  createdAt: string;
};

export type AgentListItem = {
  id: string;
  ownerUserId: string;
  name: string;
  description: string | null;
  avatarUrl: string | null;
  modelId: string | null;
  modelDisplayName: string | null;
  systemPrompt: string;
  stylePrompt: string | null;
  stanceTags: string[];
  capabilities: Record<string, unknown>;
  temperature: string | null;
  maxTokens: number | null;
  status: 'active' | 'archived' | 'disabled';
  createdAt: string;
  updatedAt: string;
};

export type TopicListItem = {
  id: string;
  ownerUserId: string;
  title: string;
  description: string;
  extraContext: string | null;
  mode: TopicMode;
  maxRounds: number;
  outputRequirements: string | null;
  winnerRule: WinnerRule;
  attachments: TopicAttachmentView[];
  status: 'draft' | 'ready' | 'archived';
  createdAt: string;
  updatedAt: string;
};

export type DebateSessionListItem = {
  id: string;
  topicId: string;
  ownerUserId: string;
  topicTitle: string;
  topicDescription: string;
  status: DebateSessionStatus;
  currentRoundNo: number;
  currentPhase: DebatePhase | null;
  winnerAgentId: string | null;
  participantCount: number;
  startedAt: string | null;
  pausedAt: string | null;
  completedAt: string | null;
  abortedAt: string | null;
  summary: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DebateParticipantView = {
  id: string;
  sessionId: string;
  agentId: string;
  seatOrder: number;
  state: ParticipantState;
  isRandomSelected: boolean;
  concedeReason: string | null;
  totalScore: number | null;
  createdAt: string;
  updatedAt: string;
  agent: Pick<AgentListItem, 'id' | 'name' | 'description' | 'avatarUrl' | 'stanceTags' | 'stylePrompt' | 'status'>;
};

export type DebateTurnView = {
  id: string;
  sessionId: string;
  roundId: string;
  participantId: string;
  turnIndex: number;
  phase: Exclude<DebatePhase, 'closed'>;
  status: 'pending' | 'streaming' | 'completed' | 'failed';
  promptSnapshot: Record<string, unknown>;
  inputContext: Record<string, unknown>;
  bubble: DebateBubble;
  summary: string;
  text: string;
  structured: DebateStructured;
  stance: 'support' | 'oppose' | 'mixed' | 'neutral';
  latencyMs: number | null;
  tokenInput: number | null;
  tokenOutput: number | null;
  isConceded: boolean;
  createdAt: string;
  updatedAt: string;
  agent: Pick<AgentListItem, 'id' | 'name' | 'avatarUrl'>;
};

export type DebateJudgeScoreView = DebateJudgeBreakdown & {
  participantId: string;
};

export type DebateArtifactView = {
  id: string;
  artifactType: 'winner_report' | 'judge_report' | 'argument_map' | 'session_summary' | 'export_json' | 'export_markdown';
  title: string | null;
  content: Record<string, unknown>;
  createdAt: string;
};

export type DebateEventView = {
  id: string;
  eventType: EventType;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type DashboardSnapshot = {
  viewer: AppUserProfile;
  agents: AgentListItem[];
  topics: TopicListItem[];
  sessions: DebateSessionListItem[];
  models: ManagedModelView[];
};

export type DebateWorkspaceSnapshot = {
  viewer: AppUserProfile;
  session: DebateSessionListItem;
  topic: TopicListItem;
  participants: DebateParticipantView[];
  turns: DebateTurnView[];
  scores: DebateJudgeScoreView[];
  artifacts: DebateArtifactView[];
  recentSessions: DebateSessionListItem[];
  events: DebateEventView[];
};

export type SessionStreamEventType =
  | 'TURN_STARTED'
  | 'TURN_STREAM_DELTA'
  | 'TURN_COMPLETED'
  | 'SESSION_COMPLETED'
  | 'SESSION_PAUSED'
  | 'SESSION_ABORTED'
  | 'SESSION_FAILED';

export type SessionStreamEvent<T = unknown> = {
  id: string;
  type: SessionStreamEventType;
  createdAt: string;
  data: T;
};
