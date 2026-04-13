import 'server-only';

import type { DebateJudgePayload, DebatePhase, DebateScoreHints, DebateTurnPayload, ModelTransport, WinnerSummaryPayload } from '@/types/domain';
import { parseJsonValue, stringifyPromptInput } from '@/lib/json';

export type LlmMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type LlmGenerateResult = {
  text: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
};

export interface LlmProvider {
  generate(messages: LlmMessage[]): Promise<LlmGenerateResult>;
}

export type LlmProviderConfig = {
  transport: ModelTransport;
  apiKey?: string;
  model: string;
  baseUrl?: string;
  provider?: string;
};

function estimateTokens(text: string) {
  return Math.max(1, Math.ceil(text.length / 4));
}

function extractLine(content: string, pattern: RegExp, fallback: string) {
  return content.match(pattern)?.[1]?.trim() || fallback;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractSection(content: string, title: string) {
  const pattern = new RegExp(`${escapeRegExp(title)}\\n([\\s\\S]*?)(?=\\n【|$)`, 'u');
  return content.match(pattern)?.[1]?.trim() || '';
}

function inferPhase(prompt: string): Exclude<DebatePhase, 'judging' | 'closed'> {
  if (prompt.includes('批判阶段')) return 'critique';
  if (prompt.includes('回应与修正阶段')) return 'rebuttal';
  if (prompt.includes('最终陈词阶段')) return 'final';
  return 'opening';
}

function roundScore(value: number) {
  return Math.round(value * 100) / 100;
}

function averageHints(hints: Partial<DebateScoreHints>) {
  return {
    logic: roundScore(Number(hints.logic ?? 6)),
    critique: roundScore(Number(hints.critique ?? 6)),
    feasibility: roundScore(Number(hints.feasibility ?? 6)),
    risk: roundScore(Number(hints.risk ?? 6)),
    alignment: roundScore(Number(hints.alignment ?? 6)),
  } satisfies DebateScoreHints;
}

function buildPhaseMock(prompt: string): DebateTurnPayload {
  const phase = inferPhase(prompt);
  const agentName = extractLine(prompt, /名称：([^\n]+)/u, 'Mock Agent');
  const topicTitle = extractLine(prompt, /标题：([^\n]+)/u, '当前议题');
  const topicDescription = extractLine(prompt, /描述：([^\n]+)/u, '围绕复杂议题进行结构化讨论');
  const focus = extractSection(prompt, '【当前焦点问题】') || extractSection(prompt, '【当前轮次整体争议点】');
  const attacks = extractSection(prompt, '【你被攻击的要点】');
  const selfSummary = extractSection(prompt, '【你的上一轮立场摘要】') || extractSection(prompt, '【你上一轮输出摘要】');
  const opponents = extractSection(prompt, '【对手观点摘要】') || extractSection(prompt, '【对手当前状态】');
  const scoreBase =
    phase === 'opening'
      ? { logic: 7.4, critique: 5.6, feasibility: 7.2, risk: 6.8, alignment: 7.5 }
      : phase === 'critique'
        ? { logic: 7.1, critique: 8.2, feasibility: 6.6, risk: 6.9, alignment: 7.4 }
        : phase === 'rebuttal'
          ? { logic: 7.6, critique: 7.2, feasibility: 7.3, risk: 7.1, alignment: 7.6 }
          : { logic: 8.1, critique: 7.5, feasibility: 7.9, risk: 7.7, alignment: 8.2 };
  const scoreHints = averageHints(scoreBase);

  if (phase === 'critique') {
    return {
      bubble: {
        title: `${agentName} 的批判`,
        excerpt: `${agentName} 针对对手在${topicTitle}上的前提假设与落地风险提出了集中反击。`,
      },
      turn: {
        phase,
        stance: 'oppose',
        summary: `${agentName} 认为对手高估了速度收益、低估了执行与风险成本。`,
        full_markdown: [
          `### ${agentName} 的定向批判`,
          `- 我针对 **${topicTitle}** 的争议核心，优先质疑对手是否把“快速推进”误当成“真实可执行”。`,
          `- 若忽略约束条件、实施窗口与风险对冲，再漂亮的方案也会在交付阶段失速。`,
          `- 更优替代是先锁定关键评价标准，再决定投入顺序，而不是直接承诺结果。`,
          focus ? `- 当前焦点里，**${focus.replace(/\n+/g, ' / ')}** 是最需要被重新界定的部分。` : '',
          opponents ? `- 对手当前观点的主要短板在于：${opponents.replace(/\n+/g, ' / ')}。` : '',
        ]
          .filter(Boolean)
          .join('\n'),
      },
      structured: {
        claims: [
          { id: 'C1', text: '决策必须先校准评价标准，不能只追求推进速度。', type: 'principle', confidence: 'high' },
          { id: 'C2', text: '对手方案低估了执行依赖和长期维护成本。', type: 'risk', confidence: 'medium' },
        ],
        attacks: [
          { target_agent: '对手阵营', type: 'premise', text: '关键前提过于乐观，缺乏约束条件说明。', severity: 'high' },
          { target_agent: '对手阵营', type: 'feasibility', text: '对实施路径与代价拆解不够具体。', severity: 'medium' },
        ],
        concessions: [{ text: '对手强调窗口期速度有一定合理性，但不足以覆盖执行风险。', impact: 'partial' }],
        questions: [{ text: '如果出现成本超支或实施阻塞，对手方案如何降级？' }],
        score_hints: scoreHints,
      },
      control: {
        concede: false,
        stop: false,
        needs_more_context: false,
      },
    };
  }

  if (phase === 'rebuttal') {
    return {
      bubble: {
        title: `${agentName} 的回应`,
        excerpt: `${agentName} 对外部质疑逐条回应，并对自己的方案做了更稳妥的修正。`,
      },
      turn: {
        phase,
        stance: 'mixed',
        summary: `${agentName} 接受部分攻击成立，但认为经修正后的主张仍更平衡。`,
        full_markdown: [
          `### ${agentName} 的回应与修正`,
          attacks ? `- 我先回应针对我的关键攻击：${attacks.replace(/\n+/g, ' / ')}。` : '- 我先回应针对我的关键攻击，并区分哪些成立、哪些被夸大了。',
          selfSummary ? `- 上一轮我的核心主张是：${selfSummary.replace(/\n+/g, ' / ')}。` : '',
          '- 我承认某些批评提示了实施细节仍需补强，但这更像是修正空间，不构成推翻论证的理由。',
          '- 修正后的方案会在保留主路径优势的前提下，补上约束校验、风险缓冲与资源分配机制。',
          '- 因此，当前更优解不是后退，而是更精确地前进。',
        ]
          .filter(Boolean)
          .join('\n'),
      },
      structured: {
        claims: [
          { id: 'R1', text: '方案可以通过补充约束与缓冲机制完成修正，而不必整体放弃。', type: 'response', confidence: 'high' },
        ],
        attacks: [],
        concessions: [{ text: '对手关于实施复杂度的提醒成立，需要显式纳入方案。', impact: 'high' }],
        questions: [{ text: '在修正之后，对手是否还能提出更强的替代路径？' }],
        score_hints: scoreHints,
      },
      control: {
        concede: false,
        stop: false,
        needs_more_context: false,
      },
    };
  }

  if (phase === 'final') {
    return {
      bubble: {
        title: `${agentName} 的终局陈词`,
        excerpt: `${agentName} 把争论压缩成可裁决的核心差异，明确说明自己为什么更值得胜出。`,
      },
      turn: {
        phase,
        stance: 'support',
        summary: `${agentName} 将胜负焦点收束到“可执行性、风险控制与目标一致度”的综合优势。`,
        full_markdown: [
          `### ${agentName} 的最终主张`,
          `- 在 **${topicTitle}** 这类议题上，真正重要的不是谁口号更激进，而是谁能在目标、成本与风险之间给出更稳的均衡。`,
          opponents ? `- 与最强对手相比，我的优势在于：${opponents.replace(/\n+/g, ' / ')}。` : '- 与最强对手相比，我的优势在于既保留行动速度，又没有牺牲治理与落地质量。',
          '- 我把争论拉回了评价标准本身，因此结论更可复盘、更适合真实决策。',
          `- 基于 ${topicDescription} 的目标设定，我仍然是更值得胜出的方案。`,
        ].join('\n'),
      },
      structured: {
        claims: [
          { id: 'F1', text: '综合可执行性、风险与目标一致度后，我的方案更稳健。', type: 'final', confidence: 'high' },
        ],
        attacks: [],
        concessions: [],
        questions: [],
        score_hints: scoreHints,
      },
      control: {
        concede: false,
        stop: false,
        needs_more_context: false,
      },
    };
  }

  return {
    bubble: {
      title: `${agentName} 的立场`,
      excerpt: `${agentName} 先对 ${topicTitle} 建立判断框架，再给出自己的核心主张。`,
    },
    turn: {
      phase,
      stance: 'support',
      summary: `${agentName} 主张先定义标准、再推进方案，以避免讨论只剩抽象口号。`,
      full_markdown: [
        `### ${agentName} 的开场立场`,
        `- 议题 **${topicTitle}** 的关键，不在于谁声音更大，而在于谁能把判断依据说清楚。`,
        `- 我会优先从目标、约束、实施路径与风险控制四个维度建立讨论框架。`,
        `- 如果缺少这些结构，任何结论都很容易变成不可复盘的表态。`,
        focus ? `- 当前最值得先拆解的焦点是：${focus.replace(/\n+/g, ' / ')}。` : '',
      ]
        .filter(Boolean)
        .join('\n'),
    },
    structured: {
      claims: [
        { id: 'O1', text: '要先统一评价标准，再比较不同立场的优劣。', type: 'principle', confidence: 'high' },
        { id: 'O2', text: '方案必须同时回答执行路径与风险控制问题。', type: 'feasibility', confidence: 'medium' },
      ],
      attacks: [],
      concessions: [],
      questions: [{ text: '如果评价标准不一致，后续争论是否会失焦？' }],
      score_hints: scoreHints,
    },
    control: {
      concede: false,
      stop: false,
      needs_more_context: false,
    },
  };
}

function buildJudgeMock(prompt: string): DebateJudgePayload {
  const input = parseJsonValue<{
    topicTitle: string;
    participants: Array<{
      agentId: string;
      agentName: string;
      state: string;
      averages: DebateScoreHints;
      latestSummary?: string;
      phaseCoverage?: string[];
      responsivenessScore?: number;
      repetitionPenalty?: number;
    }>;
  }>(prompt);

  const breakdown = input.participants.map((participant) => {
    const hints = averageHints(participant.averages);
    const responsiveness = roundScore(Number(participant.responsivenessScore ?? 6));
    const repetitionPenalty = roundScore(Number(participant.repetitionPenalty ?? 0));
    const total = roundScore(
      hints.logic * 0.24 +
        hints.critique * 0.2 +
        hints.feasibility * 0.2 +
        hints.risk * 0.16 +
        hints.alignment * 0.2 +
        (responsiveness - 5) * 0.08 -
        repetitionPenalty
    );

    return {
      agent_name: participant.agentName,
      agent_id: participant.agentId,
      logic_score: hints.logic,
      critique_score: hints.critique,
      feasibility_score: hints.feasibility,
      risk_score: hints.risk,
      alignment_score: hints.alignment,
      total_score: total,
      responsiveness_score: responsiveness,
      repetition_penalty: repetitionPenalty,
      penalties: repetitionPenalty > 0 ? [{ reason: '重复表达偏多', value: repetitionPenalty }] : [],
      evidence_notes: [`阶段覆盖：${participant.phaseCoverage?.join('、') || '有限'}`],
      decisive_turn_ids: [],
      strengths: [`${participant.agentName} 的论证结构较完整`, `能够围绕 ${input.topicTitle} 持续聚焦`],
      weaknesses: participant.state === 'conceded' ? ['已在后续轮次中主动认输，竞争力下降'] : ['仍有部分细节可以更具体'],
    };
  });

  const winner =
    breakdown.sort((left, right) => right.total_score - left.total_score)[0] || {
      agent_name: 'Unknown',
      agent_id: '',
      total_score: 0,
    };

  return {
    winner_agent_name: winner.agent_name,
    winner_agent_id: winner.agent_id,
    overall_summary: `${winner.agent_name} 在 ${input.topicTitle} 的辩论中，以更均衡的逻辑、可执行性和风险控制拿下优势。`,
    score_breakdown: breakdown,
    decisive_reasons: [
      `${winner.agent_name} 在关键回合里始终围绕裁决目标而非表面立场展开论证。`,
      '其方案同时覆盖了实施路径、风险缓冲和评价标准，完成度更高。',
    ],
    final_recommendation_markdown: `推荐采纳 **${winner.agent_name}** 的主张，并以其论证框架作为后续执行与复盘基线。`,
  };
}

function buildWinnerMock(prompt: string): WinnerSummaryPayload {
  const input = parseJsonValue<{
    topicTitle: string;
    winnerAgentId: string;
    winnerAgentName: string;
    overallSummary: string;
    decisiveReasons: string[];
  }>(prompt);

  return {
    bubble: {
      title: '冠军结论',
      excerpt: `${input.winnerAgentName} 在 ${input.topicTitle} 的辩论中胜出，原因是论证更完整、落地更稳。`,
    },
    winner_card: {
      agent_name: input.winnerAgentName,
      headline: `${input.winnerAgentName} 胜出`,
      why_win: input.decisiveReasons,
      key_points: ['逻辑链更完整', '风险意识更强', '更贴近议题目标'],
    },
    detail_panel: {
      summary_markdown: input.overallSummary,
      recommended_next_actions: ['复盘胜出论证中的关键判断标准', '把冠军方案沉淀为可执行行动项'],
    },
  };
}

export class MockLlmProvider implements LlmProvider {
  async generate(messages: LlmMessage[]): Promise<LlmGenerateResult> {
    const system = messages[0]?.content ?? '';
    const last = messages[messages.length - 1]?.content ?? '';

    if (system.includes('"score_breakdown"')) {
      const text = stringifyPromptInput(buildJudgeMock(last));
      return {
        text,
        usage: { inputTokens: estimateTokens(last), outputTokens: estimateTokens(text) },
      };
    }

    if (system.includes('"winner_card"')) {
      const text = stringifyPromptInput(buildWinnerMock(last));
      return {
        text,
        usage: { inputTokens: estimateTokens(last), outputTokens: estimateTokens(text) },
      };
    }

    const payload = buildPhaseMock(last);
    const text = stringifyPromptInput(payload);

    return {
      text,
      usage: { inputTokens: estimateTokens(last), outputTokens: estimateTokens(text) },
    };
  }
}

function extractOpenAiText(payload: unknown): string {
  if (!payload || typeof payload !== 'object') {
    return '';
  }

  const record = payload as Record<string, unknown>;

  if (typeof record.output_text === 'string' && record.output_text.length > 0) {
    return record.output_text;
  }

  if (Array.isArray(record.output)) {
    const chunks = record.output.flatMap((entry) => {
      if (!entry || typeof entry !== 'object') return [];
      const content = (entry as { content?: unknown }).content;
      if (!Array.isArray(content)) return [];

      return content.flatMap((item) => {
        if (!item || typeof item !== 'object') return [];
        const typedItem = item as { text?: string; type?: string };
        if (typeof typedItem.text === 'string') return [typedItem.text];
        return [];
      });
    });

    return chunks.join('\n').trim();
  }

  return '';
}

function extractChatCompletionsText(payload: unknown): string {
  if (!payload || typeof payload !== 'object') {
    return '';
  }

  const record = payload as {
    choices?: Array<{
      message?: {
        content?: string | Array<{ type?: string; text?: string }>;
      };
    }>;
  };

  const content = record.choices?.[0]?.message?.content;

  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => (typeof item?.text === 'string' ? item.text : ''))
      .filter(Boolean)
      .join('\n')
      .trim();
  }

  return '';
}

function extractAnthropicText(payload: unknown) {
  if (!payload || typeof payload !== 'object') {
    return '';
  }

  const record = payload as {
    content?: Array<{ type?: string; text?: string }>;
  };

  return (
    record.content
      ?.map((item) => (item.type === 'text' && typeof item.text === 'string' ? item.text : ''))
      .filter(Boolean)
      .join('\n')
      .trim() || ''
  );
}

export class OpenAILlmProvider implements LlmProvider {
  constructor(
    private readonly options: {
      apiKey: string;
      model: string;
      baseUrl?: string;
    }
  ) {}

  async generate(messages: LlmMessage[]): Promise<LlmGenerateResult> {
    const baseUrl = this.options.baseUrl || 'https://api.openai.com/v1';
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/responses`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.options.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.options.model,
        input: messages.map((message) => ({
          role: message.role,
          content: [{ type: 'input_text', text: message.content }],
        })),
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`OpenAI request failed (${response.status}): ${body}`);
    }

    const payload = (await response.json()) as Record<string, unknown>;
    const text = extractOpenAiText(payload);

    if (!text) {
      throw new Error('OpenAI provider returned an empty response payload.');
    }

    const usage = payload.usage as { input_tokens?: number; output_tokens?: number } | undefined;

    return {
      text,
      usage: {
        inputTokens: usage?.input_tokens,
        outputTokens: usage?.output_tokens,
      },
    };
  }
}

export class OpenAICompatibleLlmProvider implements LlmProvider {
  constructor(
    private readonly options: {
      apiKey: string;
      model: string;
      baseUrl: string;
    }
  ) {}

  async generate(messages: LlmMessage[]): Promise<LlmGenerateResult> {
    const response = await fetch(`${this.options.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.options.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.options.model,
        messages,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`OpenAI-compatible request failed (${response.status}): ${body}`);
    }

    const payload = (await response.json()) as Record<string, unknown>;
    const text = extractChatCompletionsText(payload);

    if (!text) {
      throw new Error('OpenAI-compatible provider returned an empty response payload.');
    }

    const usage = payload.usage as { prompt_tokens?: number; completion_tokens?: number } | undefined;

    return {
      text,
      usage: {
        inputTokens: usage?.prompt_tokens,
        outputTokens: usage?.completion_tokens,
      },
    };
  }
}

export class AnthropicLlmProvider implements LlmProvider {
  constructor(
    private readonly options: {
      apiKey: string;
      model: string;
      baseUrl?: string;
    }
  ) {}

  async generate(messages: LlmMessage[]): Promise<LlmGenerateResult> {
    const systemMessages = messages.filter((message) => message.role === 'system').map((message) => message.content);
    const conversation = messages
      .filter((message) => message.role !== 'system')
      .map((message) => ({
        role: message.role === 'assistant' ? 'assistant' : 'user',
        content: message.content,
      }));

    const baseUrl = this.options.baseUrl || 'https://api.anthropic.com/v1';
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/messages`, {
      method: 'POST',
      headers: {
        'x-api-key': this.options.apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.options.model,
        max_tokens: 4000,
        system: systemMessages.join('\n\n').trim() || undefined,
        messages: conversation,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Anthropic request failed (${response.status}): ${body}`);
    }

    const payload = (await response.json()) as Record<string, unknown>;
    const text = extractAnthropicText(payload);

    if (!text) {
      throw new Error('Anthropic provider returned an empty response payload.');
    }

    const usage = payload.usage as { input_tokens?: number; output_tokens?: number } | undefined;

    return {
      text,
      usage: {
        inputTokens: usage?.input_tokens,
        outputTokens: usage?.output_tokens,
      },
    };
  }
}

export function createConfiguredLlmProvider(config: LlmProviderConfig) {
  if (config.transport === 'mock') {
    return new MockLlmProvider();
  }

  if (!config.apiKey) {
    throw new Error(`${config.provider || config.transport} is missing an API key.`);
  }

  if (config.transport === 'anthropic') {
    return new AnthropicLlmProvider({
      apiKey: config.apiKey,
      model: config.model,
      baseUrl: config.baseUrl,
    });
  }

  if (config.transport === 'openai-compatible') {
    return new OpenAICompatibleLlmProvider({
      apiKey: config.apiKey,
      model: config.model,
      baseUrl: config.baseUrl || 'https://api.openai.com/v1',
    });
  }

  return new OpenAILlmProvider({
    apiKey: config.apiKey,
    model: config.model,
    baseUrl: config.baseUrl,
  });
}

export function createLlmProvider() {
  const preferredProvider = (process.env.LLM_PROVIDER || '').toLowerCase();
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.DEFAULT_MODEL || 'gpt-5.4-mini';

  if ((preferredProvider === 'openai' || (!preferredProvider && apiKey)) && apiKey) {
    return createConfiguredLlmProvider({
      transport: 'openai',
      apiKey,
      model,
      baseUrl: process.env.OPENAI_BASE_URL,
      provider: 'openai',
    });
  }

  if (preferredProvider === 'anthropic' && process.env.ANTHROPIC_API_KEY) {
    return createConfiguredLlmProvider({
      transport: 'anthropic',
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: process.env.ANTHROPIC_MODEL || model,
      baseUrl: process.env.ANTHROPIC_BASE_URL,
      provider: 'anthropic',
    });
  }

  return new MockLlmProvider();
}
