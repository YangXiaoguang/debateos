'use client';

import Link from 'next/link';
import { startTransition, useEffect, useEffectEvent, useRef, useState } from 'react';

import { AppShell } from '@/components/app-shell';
import { AgentAvatar } from '@/components/ui/agent-avatar';
import { ActionButton, EmptyState, MetricTile, ProgressMeter, SectionTitle, StatusBadge, SurfaceCard, cx } from '@/components/ui/console-kit';
import { resolveAgentAvatarPreset } from '@/lib/agents/avatar-presets';
import { requestJson } from '@/lib/client/request-json';
import type { DebateParticipantView, DebateTurnView, DebateWorkspaceSnapshot, ParticipantState } from '@/types/domain';

function formatTimestamp(value: string | null) {
  if (!value) return '未开始';
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function attachmentTone(status: DebateWorkspaceSnapshot['topic']['attachments'][number]['extractionStatus']) {
  if (status === 'ready') return 'success' as const;
  if (status === 'partial') return 'warning' as const;
  if (status === 'failed') return 'danger' as const;
  return 'neutral' as const;
}

function participantTone(state: ParticipantState) {
  if (state === 'speaking' || state === 'active') return 'info' as const;
  if (state === 'conceded' || state === 'errored' || state === 'stopped') return 'danger' as const;
  if (state === 'waiting') return 'success' as const;
  return 'neutral' as const;
}

function connectionTone(state: 'idle' | 'live' | 'reconnecting') {
  if (state === 'live') return 'success' as const;
  if (state === 'reconnecting') return 'warning' as const;
  return 'neutral' as const;
}

function sessionTone(status: DebateWorkspaceSnapshot['session']['status']) {
  if (status === 'completed') return 'success' as const;
  if (status === 'running') return 'info' as const;
  if (status === 'paused') return 'warning' as const;
  if (status === 'aborted' || status === 'failed') return 'danger' as const;
  return 'neutral' as const;
}

function formatMetricValue(value?: number | null) {
  return typeof value === 'number' ? value.toFixed(2) : '--';
}

function textListKey(scope: string, index: number, value: string) {
  return `${scope}-${index}-${value}`;
}

function upsertTurn(list: DebateTurnView[], nextTurn: DebateTurnView) {
  const existingIndex = list.findIndex((turn) => turn.id === nextTurn.id);
  if (existingIndex === -1) {
    return [...list, nextTurn].sort((left, right) => left.turnIndex - right.turnIndex);
  }

  const clone = [...list];
  clone[existingIndex] = nextTurn;
  return clone.sort((left, right) => left.turnIndex - right.turnIndex);
}

function parseStreamPayload(raw: string) {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    const fragments = raw
      .split(/\n+/)
      .map((item) => item.trim())
      .filter(Boolean);

    for (let index = fragments.length - 1; index >= 0; index -= 1) {
      const fragment = fragments[index];
      if (!fragment) {
        continue;
      }

      try {
        return JSON.parse(fragment) as unknown;
      } catch {
        continue;
      }
    }

    return null;
  }
}

function normalizePreviewText(value: string) {
  return value
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
    .replace(/^>\s?/gm, '')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

function buildTurnSummaryText(turn: DebateTurnView) {
  return normalizePreviewText(turn.summary || turn.bubble.excerpt || turn.text || '当前回合正在生成中。');
}

function buildTurnPreviewText(turn: DebateTurnView) {
  const summaryText = buildTurnSummaryText(turn);
  const normalizedBody = normalizePreviewText(turn.text || turn.bubble.excerpt || '');

  if (!normalizedBody) {
    return null;
  }

  if (normalizedBody === summaryText) {
    return null;
  }

  return normalizedBody;
}

function buildClaimListItems(values: string[]) {
  return values
    .map((value) => normalizePreviewText(value))
    .map((value) => value.trim())
    .filter(Boolean);
}

function formatPhaseLabel(phase: DebateTurnView['phase']) {
  switch (phase) {
    case 'opening':
      return '开场陈述';
    case 'critique':
      return '交叉批判';
    case 'rebuttal':
      return '回应反驳';
    case 'final':
      return '最终陈词';
    case 'judging':
      return '裁判评议';
    default:
      return phase;
  }
}

function formatParticipantStateLabel(state: ParticipantState) {
  switch (state) {
    case 'active':
      return '准备回应';
    case 'speaking':
      return '正在发言';
    case 'waiting':
      return '等待中';
    case 'pending':
      return '待命';
    case 'conceded':
      return '已让步';
    case 'stopped':
      return '已停止';
    case 'errored':
      return '异常中断';
    default:
      return state;
  }
}

function turnStatusTone(status: DebateTurnView['status']) {
  if (status === 'streaming') return 'info' as const;
  if (status === 'completed') return 'success' as const;
  if (status === 'failed') return 'danger' as const;
  return 'neutral' as const;
}

function formatTurnStatusLabel(status: DebateTurnView['status']) {
  switch (status) {
    case 'streaming':
      return '输出中';
    case 'completed':
      return '已完成';
    case 'failed':
      return '已失败';
    case 'pending':
      return '待生成';
    default:
      return status;
  }
}

function formatStanceLabel(stance: DebateTurnView['stance']) {
  switch (stance) {
    case 'support':
      return '支持方';
    case 'oppose':
      return '反对方';
    case 'mixed':
      return '综合立场';
    case 'neutral':
      return '中立分析';
    default:
      return stance;
  }
}

function TurnTimelineCard({
  turn,
  participant,
  isActive,
  onFavorite,
  favoritePending,
  registerRef,
}: {
  turn: DebateTurnView;
  participant: DebateParticipantView | null;
  isActive: boolean;
  onFavorite: (turnId: string) => void;
  favoritePending: boolean;
  registerRef?: (node: HTMLDivElement | null) => void;
}) {
  const keyClaimItems = turn.structured.claims.slice(0, 3).map((claim) => claim.text).filter(Boolean);
  const summaryText = buildTurnSummaryText(turn);
  const previewText = buildTurnPreviewText(turn);
  const [isPreviewExpanded, setIsPreviewExpanded] = useState(false);
  const [activePanel, setActivePanel] = useState<'dialogue' | 'claims'>('dialogue');
  const claimListItems = buildClaimListItems(keyClaimItems);
  const avatarPreset = resolveAgentAvatarPreset(turn.agent.avatarUrl, participant?.agentId || turn.agent.id);
  const isRightAligned = ((participant?.seatOrder ?? 1) % 2 === 0);
  const bubbleBackground = isRightAligned ? avatarPreset.palette.rightBubble : avatarPreset.palette.leftBubble;
  const phaseLabel = formatPhaseLabel(turn.phase);
  const stanceLabel = formatStanceLabel(turn.stance);
  const stateLabel = participant ? formatParticipantStateLabel(participant.state) : formatTurnStatusLabel(turn.status);
  const stateTone = participant ? participantTone(participant.state) : turnStatusTone(turn.status);
  const summaryLabel = turn.status === 'streaming' ? '实时摘要' : '本轮摘要';
  const previewLabel = turn.status === 'streaming' ? '实时摘录' : '内容预览';
  const articleShadow = isActive
    ? `0 0 0 1px ${avatarPreset.palette.accentText} inset, 0 28px 64px ${avatarPreset.palette.shadow}`
    : `0 24px 54px ${avatarPreset.palette.shadow}`;
  const canTogglePreview = Boolean(previewText && (previewText.length > 120 || previewText.includes('\n')));
  const surfaceStyle = {
    borderColor: avatarPreset.palette.chipBorder,
    background: 'linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))',
  };
  const summarySurfaceStyle = {
    borderColor: isActive ? avatarPreset.palette.accentText : avatarPreset.palette.chipBorder,
    background: isActive
      ? 'linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))'
      : 'linear-gradient(180deg, rgba(255,255,255,0.055), rgba(255,255,255,0.02))',
  };
  const collapsedPreviewStyle = !isPreviewExpanded
    ? {
        maxHeight: '5.25rem',
        overflow: 'hidden',
      }
    : undefined;

  useEffect(() => {
    setIsPreviewExpanded(false);
  }, [turn.id]);

  useEffect(() => {
    setActivePanel('dialogue');
  }, [turn.id]);

  return (
    <div ref={registerRef} className={cx('flex w-full scroll-mt-28', isRightAligned ? 'justify-end' : 'justify-start')}>
      <div className={cx('flex w-full max-w-[980px] items-end gap-4', isRightAligned ? 'flex-row-reverse' : 'flex-row')}>
        <div className="relative hidden sm:block">
          <AgentAvatar avatarUrl={turn.agent.avatarUrl} seed={participant?.agentId || turn.agent.id} name={turn.agent.name} size="lg" />
          {isActive ? <span className="absolute -right-1 -top-1 inline-flex h-4 w-4 rounded-full border border-cyan-200/60 bg-cyan-300 shadow-[0_0_22px_rgba(103,232,249,0.6)] animate-pulse" /> : null}
        </div>

        <article
          className={cx('relative w-full max-w-[780px] overflow-hidden rounded-[32px] border px-4 py-4 transition sm:px-5 sm:py-5', isActive && 'z-10')}
          aria-current={isActive ? 'true' : undefined}
          style={{
            background: bubbleBackground,
            borderColor: isActive ? avatarPreset.palette.accentText : avatarPreset.palette.border,
            boxShadow: articleShadow,
          }}
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-80"
            style={{
              background:
                'radial-gradient(circle at top left, rgba(255,255,255,0.05), transparent 24%), linear-gradient(180deg, rgba(255,255,255,0.025), rgba(255,255,255,0))',
            }}
          />
          <div
            className={cx('absolute inset-y-5 hidden w-1 rounded-full sm:block', isRightAligned ? 'right-4' : 'left-4')}
            style={{ background: isActive ? avatarPreset.palette.accentText : avatarPreset.palette.chipBorder }}
          />
          <div
            className={cx('absolute bottom-6 hidden h-4 w-4 rotate-45 rounded-[4px] border sm:block', isRightAligned ? '-right-2' : '-left-2')}
            style={{
              background: bubbleBackground,
              borderColor: isActive ? avatarPreset.palette.accentText : avatarPreset.palette.border,
            }}
          />

          <div className={cx('relative', isRightAligned ? 'sm:ml-auto sm:max-w-[660px]' : 'sm:mr-auto sm:max-w-[660px]')}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <AgentAvatar avatarUrl={turn.agent.avatarUrl} seed={participant?.agentId || turn.agent.id} name={turn.agent.name} size="sm" className="sm:hidden" />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="truncate text-lg font-semibold text-white">{turn.agent.name}</div>
                    {isActive ? (
                      <span
                        className="inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-[0.16em] uppercase"
                        style={{
                          borderColor: avatarPreset.palette.accentText,
                          background: 'rgba(8,18,34,0.42)',
                          color: avatarPreset.palette.accentText,
                        }}
                      >
                        正在发言
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/40">
                    <span className="truncate">{turn.bubble.title}</span>
                    <span>{stanceLabel}</span>
                    {participant ? <span>{`席位 ${participant.seatOrder}`}</span> : null}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 self-start">
                <div className="text-[11px] text-white/32">{formatTimestamp(turn.updatedAt)}</div>
                <button
                  type="button"
                  onClick={() => onFavorite(turn.id)}
                  disabled={favoritePending}
                  className="inline-flex items-center rounded-full border border-white/10 px-2.5 py-1.5 text-[11px] text-white/54 transition hover:border-white/18 hover:text-white/82 disabled:cursor-not-allowed disabled:opacity-55"
                >
                  {favoritePending ? '收藏中' : '收藏'}
                </button>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <StatusBadge>{phaseLabel}</StatusBadge>
              <StatusBadge tone={stateTone}>{stateLabel}</StatusBadge>
            </div>

            <div className="mt-5">
              {claimListItems.length > 0 ? (
                <div className="mb-4 flex items-center gap-2 rounded-full border border-white/10 bg-black/10 p-1">
                  {[
                    { key: 'dialogue', label: '当前对话' },
                    { key: 'claims', label: '关键论点' },
                  ].map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setActivePanel(item.key as 'dialogue' | 'claims')}
                      className={cx(
                        'relative inline-flex items-center rounded-full px-4 py-2 text-sm font-medium transition',
                        activePanel === item.key
                          ? 'bg-white/[0.12] text-white'
                          : 'text-white/46 hover:text-white/78'
                      )}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              ) : null}

              {activePanel === 'claims' && claimListItems.length > 0 ? (
                <div className="rounded-[24px] border px-4 py-4" style={surfaceStyle}>
                  <div className="text-[11px] uppercase tracking-[0.18em] text-white/34">关键论点</div>
                  <ul className="mt-4 space-y-3">
                    {claimListItems.map((item, index) => (
                      <li
                        key={textListKey(`${turn.id}-claim`, index, item)}
                        className="rounded-[18px] border border-white/8 bg-black/[0.12] px-4 py-3 text-sm leading-7 text-white/78"
                      >
                        <span className="block font-semibold text-white/92">{`论点 ${index + 1}`}</span>
                        <span className="mt-1 block">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="grid gap-4">
                  <div className="rounded-[24px] border px-4 py-4" style={summarySurfaceStyle}>
                    <div className="flex items-start gap-3">
                      <span
                        className="mt-1 hidden h-12 w-1.5 rounded-full sm:block"
                        style={{ background: isActive ? avatarPreset.palette.accentText : avatarPreset.palette.chipBorder }}
                      />
                      <div className="min-w-0">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-white/34">{summaryLabel}</div>
                        <div className="mt-3 max-w-[58ch] text-[15px] leading-8 text-white/92">{summaryText}</div>
                      </div>
                    </div>
                  </div>

                  {previewText ? (
                    <div className="rounded-[24px] border px-4 py-4" style={surfaceStyle}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-white/34">{previewLabel}</div>
                        {canTogglePreview ? (
                          <button
                            type="button"
                            onClick={() => setIsPreviewExpanded((current) => !current)}
                            className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-white/56 transition hover:border-white/18 hover:text-white/82"
                          >
                            {isPreviewExpanded ? '收起预览' : '展开预览'}
                          </button>
                        ) : null}
                      </div>
                      <div className="relative mt-3">
                        <div
                          className="max-w-[60ch] whitespace-pre-wrap text-sm leading-7 text-white/76"
                          style={collapsedPreviewStyle}
                        >
                          {previewText}
                        </div>
                        {canTogglePreview && !isPreviewExpanded ? (
                          <div
                            className="pointer-events-none absolute inset-x-0 bottom-0 h-12 rounded-b-[18px]"
                            style={{
                              background: 'linear-gradient(180deg, rgba(17, 33, 54, 0), rgba(17, 33, 54, 0.96))',
                            }}
                          />
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/8 pt-4">
              <span className="text-[11px] tracking-[0.18em] text-white/30">裁判印象</span>
              {[
                `逻辑 ${turn.structured.score_hints.logic}`,
                `批判 ${turn.structured.score_hints.critique}`,
                `可行性 ${turn.structured.score_hints.feasibility}`,
              ].map((item, index) => (
                <span
                  key={textListKey(turn.id, index, item)}
                  className="inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] text-white/56"
                  style={{
                    borderColor: avatarPreset.palette.chipBorder,
                    background: 'rgba(255,255,255,0.02)',
                  }}
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        </article>
      </div>
    </div>
  );
}

function CurrentSpeakerBar({
  activeParticipant,
  activeTurn,
  connectionState,
  followLive,
  onToggleFollow,
  onJumpToCurrent,
}: {
  activeParticipant: DebateParticipantView | null;
  activeTurn: DebateTurnView | null;
  connectionState: 'idle' | 'live' | 'reconnecting';
  followLive: boolean;
  onToggleFollow: () => void;
  onJumpToCurrent: () => void;
}) {
  const avatarSeed = activeParticipant?.agentId || activeTurn?.agent.id || 'focus';
  const title = activeParticipant?.agent.name || activeTurn?.agent.name || '等待下一位发言者';
  const subtitle =
    activeTurn?.phase && activeParticipant
      ? `${formatPhaseLabel(activeTurn.phase)} · ${formatParticipantStateLabel(activeParticipant.state)}`
      : activeTurn?.phase
        ? `${formatPhaseLabel(activeTurn.phase)} · ${formatTurnStatusLabel(activeTurn.status)}`
        : connectionState === 'live'
          ? '会话运行中'
          : '当前没有正在输出的发言';
  const preview = activeTurn
    ? buildTurnPreviewText(activeTurn) || buildTurnSummaryText(activeTurn)
    : '实时辩论开始后，这里会始终固定显示当前发言者、阶段和最新摘录，帮助你在长时间线中保持定位。';
  const stateLabel = activeTurn ? '当前正在发言' : connectionState === 'reconnecting' ? '正在重连' : connectionState === 'live' ? '会话进行中' : '等待开始';

  return (
    <SurfaceCard tone="accent" className="sticky top-4 z-20 overflow-hidden rounded-[30px] px-5 py-5">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-2.5 w-2.5 rounded-full bg-cyan-300 shadow-[0_0_18px_rgba(103,232,249,0.7)]" />
            <div className="text-xs uppercase tracking-[0.18em] text-cyan-100/72">Live Focus</div>
            <StatusBadge tone={activeTurn ? 'info' : connectionState === 'reconnecting' ? 'warning' : 'neutral'}>
              {stateLabel}
            </StatusBadge>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <div className="relative">
              <AgentAvatar
                avatarUrl={activeParticipant?.agent.avatarUrl || activeTurn?.agent.avatarUrl}
                seed={avatarSeed}
                name={title}
                size="md"
              />
              {activeTurn ? <span className="absolute -right-1 -top-1 inline-flex h-4 w-4 rounded-full border border-cyan-100/65 bg-cyan-300 shadow-[0_0_22px_rgba(103,232,249,0.65)] animate-pulse" /> : null}
            </div>
            <div className="min-w-0">
              <div className="truncate text-lg font-semibold text-white">{title}</div>
              <div className="mt-1 text-sm text-cyan-100/74">{subtitle}</div>
            </div>
          </div>
          <div className="mt-4 rounded-[24px] border border-white/10 bg-white/[0.06] px-4 py-4">
            <div className="text-[11px] uppercase tracking-[0.18em] text-white/34">{activeTurn ? '最新摘录' : '实时提示'}</div>
            <div className="mt-3 max-w-[64ch] text-[15px] leading-8 text-white/84">{preview}</div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 xl:justify-end">
          <ActionButton variant={followLive ? 'primary' : 'secondary'} className="rounded-full px-4 py-2 text-xs" onClick={onToggleFollow}>
            {followLive ? '跟随直播已开' : '开启跟随直播'}
          </ActionButton>
          <ActionButton variant="ghost" className="rounded-full px-4 py-2 text-xs" onClick={onJumpToCurrent} disabled={!activeTurn}>
            跳转当前发言
          </ActionButton>
        </div>
      </div>
    </SurfaceCard>
  );
}

function JudgeScoreCard({
  score,
  totalScoreMax,
  isLeader,
}: {
  score: DebateWorkspaceSnapshot['scores'][number];
  totalScoreMax: number;
  isLeader: boolean;
}) {
  return (
    <SurfaceCard tone="soft" className="rounded-[24px] px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-white">{score.agent_name}</div>
          <div className="mt-1 text-[11px] text-white/36">{isLeader ? '当前领先' : '评分明细'}</div>
        </div>
        <StatusBadge tone={isLeader ? 'success' : 'info'}>{formatMetricValue(score.total_score)}</StatusBadge>
      </div>

      <div className="mt-4 text-[11px] uppercase tracking-[0.18em] text-white/36">Overall</div>
      <ProgressMeter className="mt-2" value={score.total_score} max={totalScoreMax} />

      <div className="mt-4 space-y-3">
        {([
          { label: 'logic', value: score.logic_score },
          { label: 'critique', value: score.critique_score },
          { label: 'feasibility', value: score.feasibility_score },
          { label: 'risk', value: score.risk_score },
          { label: 'alignment', value: score.alignment_score },
          ...(typeof score.responsiveness_score === 'number' ? [{ label: 'responsiveness', value: score.responsiveness_score }] : []),
        ] as Array<{ label: string; value: number }>).map(({ label, value }) => (
          <div key={`${score.participantId}-${label}`}>
            <div className="flex items-center justify-between text-[11px] text-white/44">
              <span className="uppercase tracking-[0.16em]">{label}</span>
              <span>{formatMetricValue(value)}</span>
            </div>
            <ProgressMeter className="mt-2 h-1.5" value={value} max={10} />
          </div>
        ))}
      </div>

      {typeof score.repetition_penalty === 'number' && score.repetition_penalty > 0 ? (
        <div className="mt-3 text-xs leading-6 text-amber-100/80">repetition penalty {formatMetricValue(score.repetition_penalty)}</div>
      ) : null}
      {score.strengths.length > 0 ? <div className="mt-3 text-xs leading-6 text-emerald-100/78">+ {score.strengths[0]}</div> : null}
      {score.penalties?.length ? <div className="mt-2 text-xs leading-6 text-rose-100/78">- {score.penalties[0]?.reason}</div> : null}
    </SurfaceCard>
  );
}

export function DebateWorkspace({ initialSnapshot }: { initialSnapshot: DebateWorkspaceSnapshot }) {
  const viewer = initialSnapshot.viewer;
  const [session, setSession] = useState(initialSnapshot.session);
  const [topic, setTopic] = useState(initialSnapshot.topic);
  const [participants, setParticipants] = useState(initialSnapshot.participants);
  const [turns, setTurns] = useState(initialSnapshot.turns);
  const [scores, setScores] = useState(initialSnapshot.scores);
  const [artifacts, setArtifacts] = useState(initialSnapshot.artifacts);
  const [recentSessions, setRecentSessions] = useState(initialSnapshot.recentSessions);
  const [events, setEvents] = useState(initialSnapshot.events);
  const [connectionState, setConnectionState] = useState<'idle' | 'live' | 'reconnecting'>('idle');
  const [busyAction, setBusyAction] = useState<'start' | 'pause' | 'resume' | 'abort' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [favoriteTurnId, setFavoriteTurnId] = useState<string | null>(null);
  const [followLive, setFollowLive] = useState(true);
  const turnRefs = useRef<Record<string, HTMLDivElement | null>>({});

  async function refreshSnapshot() {
    const snapshot = await requestJson<DebateWorkspaceSnapshot>(`/api/v1/debates/${session.id}`);
    startTransition(() => {
      setSession(snapshot.session);
      setTopic(snapshot.topic);
      setParticipants(snapshot.participants);
      setTurns(snapshot.turns);
      setScores(snapshot.scores);
      setArtifacts(snapshot.artifacts);
      setRecentSessions(snapshot.recentSessions);
      setEvents(snapshot.events);
    });
  }

  const applyStreamEvent = useEffectEvent((type: string, payload: unknown) => {
    if (type === 'TURN_STARTED' && payload && typeof payload === 'object' && 'turn' in payload) {
      const nextTurn = (payload as { turn: DebateTurnView }).turn;
      startTransition(() => {
        setTurns((current) => upsertTurn(current, nextTurn));
        setParticipants((current) =>
          current.map((participant) =>
            participant.id === nextTurn.participantId ? { ...participant, state: 'speaking' } : participant
          )
        );
      });
      return;
    }

    if (type === 'TURN_STREAM_DELTA' && payload && typeof payload === 'object') {
      const { turnId, delta } = payload as { turnId: string; delta: string };
      startTransition(() => {
        setTurns((current) =>
          current.map((turn) =>
            turn.id === turnId
              ? {
                  ...turn,
                  status: 'streaming',
                  text: `${turn.text}${delta}`,
                }
              : turn
          )
        );
      });
      return;
    }

    if (type === 'TURN_COMPLETED' && payload && typeof payload === 'object' && 'turn' in payload) {
      const nextTurn = (payload as { turn: DebateTurnView }).turn;
      startTransition(() => {
        setTurns((current) => upsertTurn(current, nextTurn));
        setParticipants((current) =>
          current.map((participant) =>
            participant.id === nextTurn.participantId
              ? { ...participant, state: nextTurn.isConceded ? 'conceded' : 'waiting' }
              : participant
          )
        );
      });
      return;
    }

    if (type === 'SESSION_COMPLETED' && payload && typeof payload === 'object' && 'snapshot' in payload) {
      const snapshot = (payload as { snapshot: DebateWorkspaceSnapshot }).snapshot;
      startTransition(() => {
        setSession(snapshot.session);
        setTopic(snapshot.topic);
        setParticipants(snapshot.participants);
        setTurns(snapshot.turns);
        setScores(snapshot.scores);
        setArtifacts(snapshot.artifacts);
        setRecentSessions(snapshot.recentSessions);
        setEvents(snapshot.events);
        setConnectionState('idle');
      });
      return;
    }

    if (type === 'SESSION_PAUSED' && payload && typeof payload === 'object' && 'session' in payload) {
      startTransition(() => {
        setSession((payload as { session: DebateWorkspaceSnapshot['session'] }).session);
        setConnectionState('idle');
      });
      return;
    }

    if (type === 'SESSION_ABORTED' && payload && typeof payload === 'object' && 'session' in payload) {
      startTransition(() => {
        setSession((payload as { session: DebateWorkspaceSnapshot['session'] }).session);
        setConnectionState('idle');
      });
      return;
    }

    if (type === 'SESSION_FAILED' && payload && typeof payload === 'object' && 'message' in payload) {
      setError((payload as { message: string }).message);
      setConnectionState('idle');
    }
  });

  useEffect(() => {
    if (session.status !== 'running') {
      setConnectionState('idle');
      return;
    }

    setConnectionState('live');
    const source = new EventSource(`/api/v1/debates/${session.id}/stream`);

    source.onopen = () => {
      setConnectionState('live');
    };

    const eventTypes = [
      'TURN_STARTED',
      'TURN_STREAM_DELTA',
      'TURN_COMPLETED',
      'SESSION_COMPLETED',
      'SESSION_PAUSED',
      'SESSION_ABORTED',
      'SESSION_FAILED',
    ];

    for (const eventType of eventTypes) {
      source.addEventListener(eventType, (event) => {
        if (!(event instanceof MessageEvent)) return;
        const payload = parseStreamPayload(event.data);
        if (payload === null) {
          console.warn('Ignored malformed SSE payload.', { eventType, data: event.data });
          return;
        }
        applyStreamEvent(eventType, payload);
      });
    }

    source.onerror = () => {
      setConnectionState('reconnecting');
    };

    return () => {
      source.close();
    };
  }, [applyStreamEvent, session.id, session.status]);

  async function handleControl(action: 'start' | 'pause' | 'resume' | 'abort') {
    setBusyAction(action);
    setError(null);

    try {
      const nextSession = await requestJson<typeof session>(`/api/v1/debates/${session.id}/${action}`, {
        method: 'POST',
      });

      startTransition(() => {
        setSession(nextSession);
        setRecentSessions((current) => current.map((item) => (item.id === nextSession.id ? nextSession : item)));
      });

      if (action === 'abort' || action === 'pause') {
        setConnectionState('idle');
      }

      if (action === 'start' || action === 'resume') {
        await refreshSnapshot();
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '会话控制失败。');
    } finally {
      setBusyAction(null);
    }
  }

  async function handleFavorite(turnId: string) {
    setFavoriteTurnId(turnId);

    try {
      await requestJson(`/api/v1/turns/${turnId}/favorite`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '收藏失败。');
    } finally {
      setFavoriteTurnId(null);
    }
  }

  function scrollToTurn(turnId: string) {
    const node = turnRefs.current[turnId];
    if (!node) return;
    node.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
  }

  const focusItems = turns
    .flatMap((turn) => [
      ...turn.structured.claims.map((claim) => claim.text),
      ...turn.structured.attacks.map((attack) => attack.text),
      ...turn.structured.concessions.map((concession) => concession.text),
    ])
    .slice(-6);

  const winnerArtifact = artifacts.find((artifact) => artifact.artifactType === 'winner_report');
  const judgeArtifact = artifacts.find((artifact) => artifact.artifactType === 'judge_report');
  const winnerSummaryArtifact = artifacts.find((artifact) => artifact.artifactType === 'session_summary');

  const judgeReport = (judgeArtifact?.content || {}) as {
    overall_summary?: string;
    decisive_reasons?: string[];
    final_recommendation_markdown?: string;
  };

  const judgeContent = (judgeArtifact?.content || {}) as {
    score_breakdown?: Array<{
      agent_id: string;
      agent_name: string;
      logic_score: number;
      critique_score: number;
      feasibility_score: number;
      risk_score: number;
      alignment_score: number;
      total_score: number;
      responsiveness_score?: number;
      repetition_penalty?: number;
      strengths?: string[];
      weaknesses?: string[];
      penalties?: Array<{ reason: string; value: number }>;
    }>;
  };

  const winnerContent = (winnerArtifact?.content || {}) as {
    winner_card?: {
      agent_name?: string;
      headline?: string;
      why_win?: string[];
      key_points?: string[];
    };
    detail_panel?: {
      summary_markdown?: string;
      recommended_next_actions?: string[];
    };
  };

  const renderedScores =
    judgeContent.score_breakdown && judgeContent.score_breakdown.length > 0
      ? judgeContent.score_breakdown.map((score) => ({
          participantId: score.agent_id,
          ...score,
          strengths: score.strengths || [],
          weaknesses: score.weaknesses || [],
          penalties: score.penalties || [],
        }))
      : scores;

  const sortedScores = [...renderedScores].sort((left, right) => right.total_score - left.total_score);
  const scoreLeader = sortedScores[0] ?? null;
  const totalScoreMax = scoreLeader ? Math.max(scoreLeader.total_score, 1) : 1;
  const verdictHighlights =
    winnerContent.winner_card?.why_win && winnerContent.winner_card.why_win.length > 0
      ? winnerContent.winner_card.why_win
      : judgeReport.decisive_reasons || [];

  const readyAttachments = topic.attachments.filter((attachment) => attachment.extractionStatus === 'ready').length;
  const participantMap = new Map(participants.map((participant) => [participant.id, participant]));
  const activeParticipant = participants.find((participant) => participant.state === 'speaking' || participant.state === 'active') ?? null;
  const activeTurn =
    [...turns]
      .reverse()
      .find((turn) => {
        const participant = participantMap.get(turn.participantId);
        return turn.status === 'streaming' || participant?.state === 'speaking' || participant?.state === 'active';
      }) ?? null;
  const relatedSessions = recentSessions.filter((item) => item.id !== session.id).slice(0, 4);
  const phaseProgress = Math.min(session.currentRoundNo, topic.maxRounds);
  const topSummary =
    winnerContent.winner_card?.headline ||
    session.summary ||
    judgeReport.overall_summary ||
    '当前会话正在等待更多内容推进，重点是把攻防、裁判和结论都沉淀成清晰的可复用记录。';
  const secondarySummary =
    judgeReport.final_recommendation_markdown ||
    winnerContent.detail_panel?.summary_markdown ||
    topic.extraContext ||
    '实时辩论推进后，关键结论、证据引用和裁判解释会在这里持续归拢。';

  useEffect(() => {
    if (!followLive || session.status !== 'running' || !activeTurn?.id) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      scrollToTurn(activeTurn.id);
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [activeTurn?.id, followLive, session.status]);

  return (
    <AppShell
      viewer={viewer}
      activeNav="debates"
      eyebrow="Debates / Live Workspace"
      title={topic.title}
      description={`当前状态 ${session.status} · phase ${session.currentPhase || 'waiting'} · 最近更新 ${formatTimestamp(session.updatedAt)}。现在详情页只负责会话推进、裁判阅读和结果沉淀，不再复刻旧首页那种多栏拼贴。`}
      actions={
        <>
          <Link href="/debates" className="ui-action-button ui-action-secondary">
            返回 Debates
          </Link>
          {session.status === 'completed' ? (
            <Link href="/reports" className="ui-action-button ui-action-secondary">
              查看 Reports
            </Link>
          ) : null}
        </>
      }
    >
      <div className="space-y-6">
        {error ? (
          <SurfaceCard className="rounded-[24px] border-rose-400/25 bg-rose-400/10 px-4 py-4 text-sm text-rose-100">
            {error}
          </SurfaceCard>
        ) : null}

        <SurfaceCard tone="accent" className="rounded-[30px] px-6 py-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl">
              <div className="text-sm font-medium text-cyan-100/88">Session Overview</div>
              <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-white md:text-[2rem]">{topSummary}</h2>
              <p className="mt-3 text-sm leading-7 text-[var(--text-soft)]">{secondarySummary}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <StatusBadge tone={sessionTone(session.status)}>{session.status}</StatusBadge>
                <StatusBadge tone={connectionTone(connectionState)}>{connectionState}</StatusBadge>
                <StatusBadge>{session.currentPhase || 'waiting'}</StatusBadge>
                <StatusBadge>Round {phaseProgress} / {topic.maxRounds}</StatusBadge>
                <StatusBadge>{topic.winnerRule}</StatusBadge>
              </div>
            </div>

            <div className="rounded-[26px] border border-white/10 bg-[rgba(255,255,255,0.05)] px-5 py-5 xl:w-[360px]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-white/34">Current Focus</div>
                  <div className="mt-2 flex items-center gap-3">
                    {activeParticipant ? (
                      <AgentAvatar avatarUrl={activeParticipant.agent.avatarUrl} seed={activeParticipant.agentId} name={activeParticipant.agent.name} size="sm" />
                    ) : null}
                    <div className="text-sm font-semibold text-white">{activeParticipant?.agent.name || winnerContent.winner_card?.agent_name || '等待下一位发言者'}</div>
                  </div>
                </div>
                <StatusBadge tone={activeParticipant ? 'info' : session.status === 'completed' ? 'success' : 'neutral'}>
                  {activeParticipant ? activeParticipant.state : session.status === 'completed' ? 'closed' : 'idle'}
                </StatusBadge>
              </div>
              <div className="mt-4 text-sm leading-7 text-white/68">
                {activeParticipant?.agent.description ||
                  winnerContent.winner_card?.headline ||
                  '会话开始后，这里会提示当前焦点人物或最终胜者。'}
              </div>
              <ProgressMeter className="mt-4" value={phaseProgress} max={topic.maxRounds} />
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            {(session.status === 'ready' || session.status === 'draft') ? (
              <ActionButton variant="primary" disabled={busyAction === 'start'} onClick={() => void handleControl('start')}>
                {busyAction === 'start' ? '启动中...' : '开始会话'}
              </ActionButton>
            ) : null}
            {session.status === 'running' ? (
              <ActionButton disabled={busyAction === 'pause'} onClick={() => void handleControl('pause')}>
                {busyAction === 'pause' ? '暂停中...' : '暂停'}
              </ActionButton>
            ) : null}
            {session.status === 'paused' ? (
              <ActionButton variant="primary" disabled={busyAction === 'resume'} onClick={() => void handleControl('resume')}>
                {busyAction === 'resume' ? '恢复中...' : '恢复'}
              </ActionButton>
            ) : null}
            {!['completed', 'aborted'].includes(session.status) ? (
              <ActionButton variant="danger" disabled={busyAction === 'abort'} onClick={() => void handleControl('abort')}>
                {busyAction === 'abort' ? '终止中...' : '终止'}
              </ActionButton>
            ) : null}
            <Link href="/launch" className="ui-action-button ui-action-secondary">
              再发起一场
            </Link>
          </div>
        </SurfaceCard>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <MetricTile label="Turns" value={turns.length} detail="实时产出的回合片段" />
          <MetricTile label="Participants" value={participants.length} detail="当前参战角色数" />
          <MetricTile label="Attachments Ready" value={readyAttachments} detail={`${topic.attachments.length} 份上下文资料`} />
          <MetricTile label="Judge Scores" value={renderedScores.length} detail="裁判分项评分数量" />
          <MetricTile label="Artifacts" value={artifacts.length} detail="报告、摘要与胜者卡" />
        </section>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.16fr)_380px]">
          <div className="space-y-5">
            <SurfaceCard className="rounded-[30px] px-6 py-6">
              <SectionTitle
                eyebrow="Live Timeline"
                title="实时辩论时间线"
                description="时间线默认走摘要流：先快速看谁在说、核心观点是什么，再按需展开更多预览。"
              />

              <div className="mt-5">
                <CurrentSpeakerBar
                  activeParticipant={activeParticipant}
                  activeTurn={activeTurn}
                  connectionState={connectionState}
                  followLive={followLive}
                  onToggleFollow={() => setFollowLive((current) => !current)}
                  onJumpToCurrent={() => {
                    if (activeTurn?.id) {
                      scrollToTurn(activeTurn.id);
                    }
                  }}
                />
              </div>

              <div className="mt-5 space-y-4">
                {turns.length > 0 ? (
                  turns.map((turn) => (
                    <TurnTimelineCard
                      key={turn.id}
                      turn={turn}
                      participant={participantMap.get(turn.participantId) ?? null}
                      isActive={activeTurn?.id === turn.id}
                      onFavorite={(turnId) => void handleFavorite(turnId)}
                      favoritePending={favoriteTurnId === turn.id}
                      registerRef={(node) => {
                        turnRefs.current[turn.id] = node;
                      }}
                    />
                  ))
                ) : (
                  <EmptyState className="text-left">
                    还没有 turn 产出。点击上方“开始会话”后，系统会按 `opening / critique / rebuttal / final / judging` 自动推进。
                  </EmptyState>
                )}
              </div>
            </SurfaceCard>

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.92fr)]">
              <SurfaceCard className="rounded-[30px] px-5 py-5">
                <SectionTitle
                  eyebrow="Artifacts"
                  title="辩论产物"
                  description={winnerSummaryArtifact?.title || 'Judge 报告、胜者卡和结构化摘要都会沉淀到这里。'}
                />
                <div className="mt-4 space-y-3">
                  {artifacts.length > 0 ? (
                    artifacts.map((artifact) => (
                      <SurfaceCard key={artifact.id} tone="soft" className="rounded-[22px] px-4 py-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-semibold text-white">{artifact.title || artifact.artifactType}</div>
                          <StatusBadge>{artifact.artifactType}</StatusBadge>
                        </div>
                        <div className="mt-2 text-[11px] text-white/36">{formatTimestamp(artifact.createdAt)}</div>
                      </SurfaceCard>
                    ))
                  ) : (
                    <EmptyState className="text-left">当前还没有生成辩论产物。</EmptyState>
                  )}
                </div>
              </SurfaceCard>

              <SurfaceCard className="rounded-[30px] px-5 py-5">
                <SectionTitle eyebrow="Related Sessions" title="最近会话切换" description="把相关会话收在详情页底部，避免它们继续抢首屏注意力。" />
                <div className="mt-4 space-y-3">
                  {relatedSessions.length > 0 ? (
                    relatedSessions.map((item) => (
                      <Link key={item.id} href={`/debates/${item.id}`}>
                        <SurfaceCard interactive className="rounded-[22px] px-4 py-4">
                          <div className="text-sm font-semibold text-white">{item.topicTitle}</div>
                          <div className="mt-3 flex items-center justify-between gap-2 text-[11px] text-white/36">
                            <span>{formatTimestamp(item.updatedAt)}</span>
                            <StatusBadge tone={sessionTone(item.status)}>{item.status}</StatusBadge>
                          </div>
                        </SurfaceCard>
                      </Link>
                    ))
                  ) : (
                    <EmptyState className="text-left">除了当前会话外，还没有其他可切换的记录。</EmptyState>
                  )}
                </div>
              </SurfaceCard>
            </div>
          </div>

          <div className="space-y-5">
            <SurfaceCard className="rounded-[30px] px-5 py-5">
              <SectionTitle eyebrow="Context Pack" title="会话上下文" description="Topic、附件和输出规则都在这里，阅读顺序更接近真实工作流。" />

              <div className="mt-4 text-sm font-semibold text-white">{topic.title}</div>
              <div className="mt-3 text-sm leading-7 text-[var(--text-soft)]">{topic.description}</div>

              {topic.extraContext ? (
                <div className="mt-4 rounded-[22px] border border-white/8 bg-white/4 px-4 py-4 text-sm leading-7 text-white/62">
                  {topic.extraContext}
                </div>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-2">
                <StatusBadge>{topic.winnerRule}</StatusBadge>
                <StatusBadge>{topic.maxRounds} rounds</StatusBadge>
                {topic.outputRequirements ? <StatusBadge tone="info">有输出要求</StatusBadge> : null}
                <StatusBadge>{readyAttachments} / {topic.attachments.length} attachments ready</StatusBadge>
              </div>

              {topic.outputRequirements ? (
                <div className="mt-4 rounded-[22px] border border-white/8 bg-white/4 px-4 py-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-white/34">Output Requirements</div>
                  <div className="mt-3 text-sm leading-7 text-white/62">{topic.outputRequirements}</div>
                </div>
              ) : null}

              {topic.attachments.length > 0 ? (
                <details className="mt-5 rounded-[22px] border border-white/8 bg-white/4 px-4 py-4">
                  <summary className="cursor-pointer text-sm font-semibold text-white">
                    查看附件上下文 ({topic.attachments.length})
                  </summary>
                  <div className="mt-4 space-y-3">
                    {topic.attachments.map((attachment) => (
                      <a key={attachment.id} href={attachment.fileUrl} target="_blank" rel="noreferrer">
                        <SurfaceCard interactive className="rounded-[20px] px-4 py-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="text-sm font-medium text-white">{attachment.fileName}</div>
                            <StatusBadge tone={attachmentTone(attachment.extractionStatus)}>{attachment.extractionStatus}</StatusBadge>
                            <StatusBadge>{attachment.extractionMethod}</StatusBadge>
                          </div>
                          <div className="mt-3 text-xs leading-6 text-white/56">
                            {attachment.extractionSummary || '附件已上传，等待在辩论上下文中引用。'}
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-white/36">
                            {attachment.pageCount ? <span>{attachment.pageCount} pages</span> : null}
                            {attachment.characterCount ? <span>{attachment.characterCount} chars</span> : null}
                            {typeof attachment.ocrConfidence === 'number' ? <span>OCR {attachment.ocrConfidence.toFixed(2)}</span> : null}
                          </div>
                          {attachment.extractionError ? <div className="mt-2 text-[11px] text-rose-200/82">{attachment.extractionError}</div> : null}
                        </SurfaceCard>
                      </a>
                    ))}
                  </div>
                </details>
              ) : null}
            </SurfaceCard>

            <SurfaceCard className="rounded-[30px] px-5 py-5">
              <SectionTitle eyebrow="Participants" title="参战角色" description={`${participants.length} 个席位已载入当前会话。`} />
              <div className="mt-4 space-y-3">
                {participants.map((participant) => (
                  <div key={participant.id} className="rounded-[22px] border border-white/8 bg-white/4 px-4 py-4">
                    <div className="flex items-start gap-3">
                      <AgentAvatar avatarUrl={participant.agent.avatarUrl} seed={participant.agentId} name={participant.agent.name} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-white">{participant.agent.name}</div>
                        <div className="mt-2 text-xs leading-6 text-white/42">{participant.agent.description || participant.agent.stanceTags.join(' · ') || '未设置角色说明'}</div>
                        <div className="mt-3 flex items-center justify-between gap-3">
                          <StatusBadge tone={participantTone(participant.state)}>{participant.state}</StatusBadge>
                          <div className="text-[11px] text-white/34">Seat {participant.seatOrder}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 rounded-[22px] border border-white/8 bg-white/4 px-4 py-4">
                <div className="text-xs uppercase tracking-[0.18em] text-white/34">Recent Focus</div>
                <div className="mt-3 space-y-2 text-sm leading-7 text-white/60">
                  {focusItems.length > 0 ? (
                    focusItems.map((item, index) => <div key={textListKey('focus', index, item)}>{item}</div>)
                  ) : (
                    <div>等待会话产出第一批结构化论点。</div>
                  )}
                </div>
              </div>
            </SurfaceCard>

            <SurfaceCard className="rounded-[30px] px-5 py-5">
              <SectionTitle eyebrow="Judge Board" title="裁判评分看板" description="Judge 区域保留在右侧，但只聚焦对比和判决，不再抢走主时间线的阅读重心。" />
              <div className="mt-4 space-y-3">
                {sortedScores.length > 0 ? (
                  sortedScores.map((score, index) => (
                    <JudgeScoreCard key={score.participantId} score={score} totalScoreMax={totalScoreMax} isLeader={index === 0} />
                  ))
                ) : (
                  <EmptyState className="text-left">裁决阶段完成后，这里会展示 Judge Score Breakdown。</EmptyState>
                )}
              </div>
            </SurfaceCard>

            <SurfaceCard tone="accent" className="rounded-[30px] px-5 py-5">
              <SectionTitle eyebrow="Winner Card" title={winnerContent.winner_card?.agent_name || '等待最终胜者'} />
              {winnerContent.winner_card ? (
                <div className="mt-4">
                  <div className="text-sm text-cyan-100">{winnerContent.winner_card.headline}</div>
                    <div className="mt-4 space-y-2 text-sm leading-7 text-white/72">
                      {(winnerContent.winner_card.why_win || []).map((item, index) => (
                        <div key={textListKey('why-win', index, item)}>{item}</div>
                      ))}
                    </div>
                  {winnerContent.detail_panel?.summary_markdown ? (
                    <div className="mt-4 rounded-[22px] border border-white/8 bg-white/5 px-4 py-4 text-sm leading-7 text-white/68">
                      {winnerContent.detail_panel.summary_markdown}
                    </div>
                  ) : null}
                  {winnerContent.detail_panel?.recommended_next_actions?.length ? (
                    <div className="mt-4 space-y-2 text-sm leading-7 text-white/68">
                      {winnerContent.detail_panel.recommended_next_actions.map((item, index) => (
                        <div key={textListKey('next-action', index, item)}>{item}</div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="mt-4 text-sm leading-7 text-white/62">会话完成后，这里会显示冠军结论与下一步建议。</div>
              )}
            </SurfaceCard>

            <SurfaceCard className="rounded-[30px] px-5 py-5">
              <SectionTitle eyebrow="Event Trail" title="事件轨迹" />
              <div className="mt-4 space-y-3">
                {events.slice(-6).map((event) => (
                  <SurfaceCard key={event.id} tone="soft" className="rounded-[22px] px-4 py-3">
                    <div className="text-xs uppercase tracking-[0.2em] text-white/40">{event.eventType}</div>
                    <div className="mt-2 text-xs text-white/34">{formatTimestamp(event.createdAt)}</div>
                  </SurfaceCard>
                ))}
              </div>
            </SurfaceCard>
          </div>
        </div>
      </div>

    </AppShell>
  );
}
