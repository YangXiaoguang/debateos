import 'server-only';

import type {
  DebateJudgePayload,
  DebatePhase,
  DebateScoreHints,
  DebateTurnPayload,
  ParticipantState,
  WinnerSummaryPayload,
} from '@/types/domain';
import type { LlmProvider, LlmMessage } from '@/lib/ai/provider';
import { createLlmProvider } from '@/lib/ai/provider';
import { parseJsonValue, stringifyPromptInput } from '@/lib/json';
import { loadPrompt } from '@/lib/prompts/loader';
import { renderPrompt } from '@/lib/prompts/renderer';

export type OrchestratorContext = {
  topicTitle: string;
  topicDescription: string;
  extraContext?: string;
  attachmentsSummary?: string;
  agentId: string;
  outputRequirements?: string;
  agentName: string;
  agentDescription?: string;
  stanceTags?: string;
  stylePrompt?: string;
  otherAgentsSummary?: string;
  selfOpeningSummary?: string;
  opponentsOpeningSummary?: string;
  focusPoints?: string;
  attacksAgainstMe?: string;
  selfPreviousSummary?: string;
  roundConflictsSummary?: string;
  selfCurrentSummary?: string;
  opponentsStateSummary?: string;
};

export type OrchestratorExecution<T> = {
  data: T;
  rawText: string;
  systemPrompt: string;
  userPrompt: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
};

export type JudgeContext = {
  topicTitle: string;
  topicDescription: string;
  participants: Array<{
    agentId: string;
    agentName: string;
    state: ParticipantState;
    latestSummary: string;
    averages: DebateScoreHints;
    turnCount: number;
    phaseCoverage: string[];
    attackCount: number;
    concessionCount: number;
    questionCount: number;
    responsivenessScore: number;
    repetitionPenalty: number;
  }>;
};

export type WinnerSummaryContext = {
  topicTitle: string;
  winnerAgentId: string;
  winnerAgentName: string;
  overallSummary: string;
  decisiveReasons: string[];
};

const phaseTemplateMap: Record<Exclude<DebatePhase, 'judging' | 'closed'>, string> = {
  opening: 'debate/opening_v1.md',
  critique: 'debate/critique_v1.md',
  rebuttal: 'debate/rebuttal_v1.md',
  final: 'debate/final_v1.md',
};

const allowedStances = new Set<DebateTurnPayload['turn']['stance']>(['support', 'oppose', 'mixed', 'neutral']);

function clampScore(value: unknown, fallback: number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.round(Math.max(0, Math.min(10, numeric)) * 100) / 100;
}

function normalizeScoreHints(scoreHints: Partial<DebateScoreHints> | undefined): DebateScoreHints {
  return {
    logic: clampScore(scoreHints?.logic, 6),
    critique: clampScore(scoreHints?.critique, 6),
    feasibility: clampScore(scoreHints?.feasibility, 6),
    risk: clampScore(scoreHints?.risk, 6),
    alignment: clampScore(scoreHints?.alignment, 6),
  };
}

function normalizeTurnPayload(
  phase: Exclude<DebatePhase, 'judging' | 'closed'>,
  ctx: OrchestratorContext,
  rawText: string,
  candidate: Partial<DebateTurnPayload> | undefined
): DebateTurnPayload {
  const fallbackBody = rawText.trim() || `${ctx.agentName} 在 ${phase} 阶段给出了结构化回应。`;
  const turn = candidate?.turn;
  const structured = candidate?.structured;
  const control = candidate?.control;

  return {
    bubble: {
      title: candidate?.bubble?.title?.trim() || `${ctx.agentName} · ${phase}`,
      excerpt:
        candidate?.bubble?.excerpt?.trim() ||
        `${ctx.agentName} 在 ${ctx.topicTitle} 的 ${phase} 阶段给出了一轮结构化输出。`,
    },
    turn: {
      phase,
      stance: allowedStances.has(turn?.stance as DebateTurnPayload['turn']['stance'])
        ? (turn?.stance as DebateTurnPayload['turn']['stance'])
        : 'neutral',
      summary: turn?.summary?.trim() || `${ctx.agentName} 围绕 ${ctx.topicTitle} 完成了 ${phase} 阶段发言。`,
      full_markdown: turn?.full_markdown?.trim() || fallbackBody,
    },
    structured: {
      claims: Array.isArray(structured?.claims)
        ? structured.claims.map((claim) => ({
            id: claim.id,
            text: claim.text || '未命名主张',
            type: claim.type,
            confidence: claim.confidence,
          }))
        : [],
      attacks: Array.isArray(structured?.attacks)
        ? structured.attacks.map((attack) => ({
            target_agent: attack.target_agent,
            target_claim_id: attack.target_claim_id,
            type: attack.type,
            text: attack.text || '未命名批判点',
            severity: attack.severity,
          }))
        : [],
      concessions: Array.isArray(structured?.concessions)
        ? structured.concessions.map((concession) => ({
            text: concession.text || '承认了部分对手观点',
            impact: concession.impact,
          }))
        : [],
      questions: Array.isArray(structured?.questions)
        ? structured.questions.map((question) => ({
            text: question.text || '未命名问题',
          }))
        : [],
      score_hints: normalizeScoreHints(structured?.score_hints),
    },
    control: {
      concede: Boolean(control?.concede),
      stop: Boolean(control?.stop),
      needs_more_context: Boolean(control?.needs_more_context),
    },
  };
}

function normalizeJudgePayload(ctx: JudgeContext, candidate: Partial<DebateJudgePayload> | undefined): DebateJudgePayload {
  const fallbackBreakdown = ctx.participants.map((participant) => {
    const weightedCore =
      participant.averages.logic * 0.24 +
      participant.averages.critique * 0.2 +
      participant.averages.feasibility * 0.2 +
      participant.averages.risk * 0.16 +
      participant.averages.alignment * 0.2;
    const total = clampScore(
      weightedCore + (participant.responsivenessScore - 5) * 0.08 - participant.repetitionPenalty,
      0
    );

    return {
      agent_name: participant.agentName,
      agent_id: participant.agentId,
      logic_score: participant.averages.logic,
      critique_score: participant.averages.critique,
      feasibility_score: participant.averages.feasibility,
      risk_score: participant.averages.risk,
      alignment_score: participant.averages.alignment,
      total_score: total,
      responsiveness_score: participant.responsivenessScore,
      repetition_penalty: participant.repetitionPenalty,
      penalties: participant.repetitionPenalty > 0 ? [{ reason: '重复表达和新信息不足', value: participant.repetitionPenalty }] : [],
      evidence_notes: [`覆盖阶段：${participant.phaseCoverage.join('、') || '有限'}`],
      decisive_turn_ids: [],
      strengths: [`${participant.agentName} 维持了较完整的推理结构`],
      weaknesses: participant.state === 'conceded' ? ['已主动退出后续竞争'] : ['仍有可继续展开的细节'],
    };
  });

  const scoreBreakdown =
    candidate?.score_breakdown?.map((item) => ({
      agent_name: item.agent_name,
      agent_id: item.agent_id,
      logic_score: clampScore(item.logic_score, 6),
      critique_score: clampScore(item.critique_score, 6),
      feasibility_score: clampScore(item.feasibility_score, 6),
      risk_score: clampScore(item.risk_score, 6),
      alignment_score: clampScore(item.alignment_score, 6),
      total_score: clampScore(item.total_score, 6),
      responsiveness_score: clampScore(item.responsiveness_score, 6),
      repetition_penalty: clampScore(item.repetition_penalty, 0),
      penalties: Array.isArray(item.penalties)
        ? item.penalties.map((penalty) => ({
            reason: penalty.reason || '未命名惩罚',
            value: clampScore(penalty.value, 0),
          }))
        : [],
      evidence_notes: Array.isArray(item.evidence_notes) ? item.evidence_notes.filter(Boolean) : [],
      decisive_turn_ids: Array.isArray(item.decisive_turn_ids) ? item.decisive_turn_ids.filter(Boolean) : [],
      strengths: Array.isArray(item.strengths) ? item.strengths.filter(Boolean) : [],
      weaknesses: Array.isArray(item.weaknesses) ? item.weaknesses.filter(Boolean) : [],
    })) || fallbackBreakdown;

  const winningRow =
    scoreBreakdown.find((item) => item.agent_id === candidate?.winner_agent_id) ||
    [...scoreBreakdown].sort((left, right) => right.total_score - left.total_score)[0];

  return {
    winner_agent_name: candidate?.winner_agent_name || winningRow?.agent_name || ctx.participants[0]?.agentName || '',
    winner_agent_id: candidate?.winner_agent_id || winningRow?.agent_id || ctx.participants[0]?.agentId || '',
    overall_summary:
      candidate?.overall_summary ||
      `${winningRow?.agent_name || '胜出方'} 在逻辑完整性、风险控制与可执行性上形成了更稳定的综合优势。`,
    score_breakdown: scoreBreakdown,
    decisive_reasons:
      candidate?.decisive_reasons?.filter(Boolean) || [`${winningRow?.agent_name || '胜出方'} 在关键维度上形成了更高的综合分。`],
    final_recommendation_markdown:
      candidate?.final_recommendation_markdown ||
      `推荐优先吸收 **${winningRow?.agent_name || '胜出方'}** 的论证框架，作为后续执行与复盘基线。`,
  };
}

function normalizeWinnerSummary(ctx: WinnerSummaryContext, candidate: Partial<WinnerSummaryPayload> | undefined): WinnerSummaryPayload {
  return {
    bubble: {
      title: candidate?.bubble?.title?.trim() || '冠军结论',
      excerpt:
        candidate?.bubble?.excerpt?.trim() ||
        `${ctx.winnerAgentName} 在 ${ctx.topicTitle} 的辩论中胜出，论证完整度和落地性更强。`,
    },
    winner_card: {
      agent_name: candidate?.winner_card?.agent_name?.trim() || ctx.winnerAgentName,
      headline: candidate?.winner_card?.headline?.trim() || `${ctx.winnerAgentName} 胜出`,
      why_win:
        candidate?.winner_card?.why_win?.filter(Boolean) ||
        ctx.decisiveReasons ||
        ['论证结构更清晰', '更贴近裁决目标'],
      key_points:
        candidate?.winner_card?.key_points?.filter(Boolean) ||
        ['逻辑完整', '风险意识更强', '更可执行'],
    },
    detail_panel: {
      summary_markdown: candidate?.detail_panel?.summary_markdown?.trim() || ctx.overallSummary,
      recommended_next_actions:
        candidate?.detail_panel?.recommended_next_actions?.filter(Boolean) ||
        ['把胜出观点拆成执行步骤', '沉淀关键评价标准供后续复用'],
    },
  };
}

export class DebateOrchestrator {
  constructor(private readonly provider: LlmProvider = createLlmProvider()) {}

  async runPhase(
    phase: Exclude<DebatePhase, 'judging' | 'closed'>,
    ctx: OrchestratorContext
  ): Promise<OrchestratorExecution<DebateTurnPayload>> {
    const systemPrompt = await loadPrompt('system/base_debater_v1.md');
    const userTemplate = await loadPrompt(phaseTemplateMap[phase]);

    const userPrompt = renderPrompt(userTemplate, {
      topic_title: ctx.topicTitle,
      topic_description: ctx.topicDescription,
      extra_context: ctx.extraContext,
      attachments_summary: ctx.attachmentsSummary,
      output_requirements: ctx.outputRequirements,
      agent_name: ctx.agentName,
      agent_description: ctx.agentDescription,
      stance_tags: ctx.stanceTags,
      style_prompt: ctx.stylePrompt,
      other_agents_summary: ctx.otherAgentsSummary,
      self_opening_summary: ctx.selfOpeningSummary,
      opponents_opening_summary: ctx.opponentsOpeningSummary,
      focus_points: ctx.focusPoints,
      attacks_against_me: ctx.attacksAgainstMe,
      self_previous_summary: ctx.selfPreviousSummary,
      round_conflicts_summary: ctx.roundConflictsSummary,
      self_current_summary: ctx.selfCurrentSummary,
      opponents_state_summary: ctx.opponentsStateSummary,
    });

    const messages: LlmMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    const result = await this.provider.generate(messages);
    const parsed = parseJsonValue<Partial<DebateTurnPayload>>(result.text);

    return {
      data: normalizeTurnPayload(phase, ctx, result.text, parsed),
      rawText: result.text,
      systemPrompt,
      userPrompt,
      usage: result.usage,
    };
  }

  async runJudging(ctx: JudgeContext): Promise<OrchestratorExecution<DebateJudgePayload>> {
    const systemPrompt = await loadPrompt('debate/judge_scoring_v1.md');
    const userPrompt = stringifyPromptInput(ctx);
    const messages: LlmMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];
    const result = await this.provider.generate(messages);
    const parsed = parseJsonValue<Partial<DebateJudgePayload>>(result.text);

    return {
      data: normalizeJudgePayload(ctx, parsed),
      rawText: result.text,
      systemPrompt,
      userPrompt,
      usage: result.usage,
    };
  }

  async runWinnerSummary(ctx: WinnerSummaryContext): Promise<OrchestratorExecution<WinnerSummaryPayload>> {
    const systemPrompt = await loadPrompt('debate/winner_summary_v1.md');
    const userPrompt = stringifyPromptInput(ctx);
    const messages: LlmMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];
    const result = await this.provider.generate(messages);
    const parsed = parseJsonValue<Partial<WinnerSummaryPayload>>(result.text);

    return {
      data: normalizeWinnerSummary(ctx, parsed),
      rawText: result.text,
      systemPrompt,
      userPrompt,
      usage: result.usage,
    };
  }

  getNextPhase(currentPhase: DebatePhase | null): DebatePhase {
    switch (currentPhase) {
      case null:
        return 'opening';
      case 'opening':
        return 'critique';
      case 'critique':
        return 'rebuttal';
      case 'rebuttal':
        return 'final';
      case 'final':
        return 'judging';
      default:
        return 'closed';
    }
  }
}
