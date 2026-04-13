'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { startTransition, useState } from 'react';

import { AppShell } from '@/components/app-shell';
import { ActionButton, EmptyState, MetricTile, ProgressMeter, StatusBadge, SurfaceCard, cx } from '@/components/ui/console-kit';
import { requestJson } from '@/lib/client/request-json';
import type { DashboardSnapshot, DebateSessionListItem } from '@/types/domain';

type FlowStep = 'agent' | 'topic' | 'launch';

function recommendedStep(agentCount: number, topicCount: number): FlowStep {
  if (agentCount < 2) return 'agent';
  if (topicCount < 1) return 'topic';
  return 'launch';
}

function stepTone(state: 'current' | 'ready' | 'pending') {
  if (state === 'current') return 'info' as const;
  if (state === 'ready') return 'success' as const;
  return 'warning' as const;
}

export function LaunchStudio({ initialData }: { initialData: DashboardSnapshot }) {
  const router = useRouter();
  const { viewer, topics } = initialData;
  const agents = initialData.agents.filter((agent) => Boolean(agent.modelId));
  const agentsMissingModelCount = initialData.agents.length - agents.length;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState<FlowStep>(recommendedStep(agents.length, topics.length));
  const [debateDraft, setDebateDraft] = useState({
    topicId: initialData.topics[0]?.id ?? '',
    agentIds: agents.slice(0, 2).map((agent) => agent.id),
  });

  const agentReady = debateDraft.agentIds.length >= 2;
  const topicReady = Boolean(debateDraft.topicId);
  const launchReady = agentReady && topicReady;
  const selectedTopic = topics.find((topic) => topic.id === debateDraft.topicId) ?? null;
  const selectedAgents = agents.filter((agent) => debateDraft.agentIds.includes(agent.id));

  const steps: Array<{
    key: FlowStep;
    title: string;
    description: string;
    status: 'current' | 'ready' | 'pending';
    value: number;
    max: number;
  }> = [
    {
      key: 'agent',
      title: '选择 Agent 阵容',
      description: '至少选择 2 个有明显差异的角色。',
      status: activeStep === 'agent' ? 'current' : agentReady ? 'ready' : 'pending',
      value: Math.min(debateDraft.agentIds.length, 2),
      max: 2,
    },
    {
      key: 'topic',
      title: '选择 Topic',
      description: '确认议题、规则和附件上下文。',
      status: activeStep === 'topic' ? 'current' : topicReady ? 'ready' : 'pending',
      value: topicReady ? 1 : 0,
      max: 1,
    },
    {
      key: 'launch',
      title: '确认并发起',
      description: '复核阵容后直接进入实时辩论工作台。',
      status: activeStep === 'launch' ? 'current' : launchReady ? 'ready' : 'pending',
      value: Number(agentReady) + Number(topicReady),
      max: 2,
    },
  ];

  async function handleCreateDebate() {
    setPending(true);
    setError(null);

    try {
      const created = await requestJson<DebateSessionListItem>('/api/v1/debates', {
        method: 'POST',
        body: JSON.stringify({
          topicId: debateDraft.topicId,
          agentIds: debateDraft.agentIds,
        }),
      });

      startTransition(() => {
        router.push(`/debates/${created.id}`);
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '创建 Debate 失败。');
    } finally {
      setPending(false);
    }
  }

  function renderStepPanel() {
    if (activeStep === 'agent') {
      return (
        <SurfaceCard tone="strong" className="rounded-[30px] px-5 py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-white/34">Step 1</div>
              <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-white">选择 Agent 阵容</h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--text-soft)]">
                发起页不再承担复杂角色创建，只做“选择与组装”。如果阵容还不够，直接跳去 Agent 页面补资产。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <StatusBadge tone={agentReady ? 'success' : 'warning'}>{debateDraft.agentIds.length} selected</StatusBadge>
              <Link href="/agents" className="ui-action-button ui-action-secondary">
                去补 Agent
              </Link>
            </div>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            {agentsMissingModelCount > 0 ? (
              <div className="lg:col-span-2 rounded-[24px] border border-amber-300/20 bg-amber-300/10 px-4 py-4 text-sm leading-7 text-amber-50">
                有 {agentsMissingModelCount} 个 Agent 还没有绑定模型，暂时不会出现在这里。请先去 <Link href="/agents" className="underline underline-offset-4">Agent 管理页</Link> 绑定模型。
              </div>
            ) : null}
            {agents.length > 0 ? (
              agents.map((agent) => {
                const checked = debateDraft.agentIds.includes(agent.id);

                return (
                  <label
                    key={agent.id}
                    className={cx(
                      'cursor-pointer rounded-[24px] border px-4 py-4 transition',
                      checked ? 'border-cyan-300/30 bg-cyan-300/10' : 'border-white/8 bg-white/4 hover:bg-white/6'
                    )}
                  >
                    <input
                      type="checkbox"
                      className="hidden"
                      checked={checked}
                      onChange={() =>
                        setDebateDraft((current) => {
                          const nextIds = checked
                            ? current.agentIds.filter((agentId) => agentId !== agent.id)
                            : [...current.agentIds, agent.id].slice(0, 4);
                          return { ...current, agentIds: nextIds };
                        })
                      }
                    />
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-white">{agent.name}</div>
                        <div className="mt-2 text-xs leading-6 text-white/44">{agent.description || '未填写角色说明'}</div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <StatusBadge>{agent.modelDisplayName || '系统默认模型'}</StatusBadge>
                          {agent.stanceTags.length > 0 ? <StatusBadge tone="info">{agent.stanceTags.join(' · ')}</StatusBadge> : null}
                        </div>
                      </div>
                      <StatusBadge tone={checked ? 'info' : 'neutral'}>{checked ? 'selected' : 'idle'}</StatusBadge>
                    </div>
                  </label>
                );
              })
            ) : (
              <EmptyState className="text-left">
                当前还没有 Agent。先去 Agents 页面创建至少两个立场明显不同的角色。
              </EmptyState>
            )}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <ActionButton
              variant="primary"
              onClick={() => setActiveStep('topic')}
              disabled={debateDraft.agentIds.length < 2}
            >
              下一步：选择 Topic
            </ActionButton>
          </div>
        </SurfaceCard>
      );
    }

    if (activeStep === 'topic') {
      return (
        <SurfaceCard tone="strong" className="rounded-[30px] px-5 py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-white/34">Step 2</div>
              <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-white">选择 Topic</h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--text-soft)]">
                这里专注选择已有 Topic。新建和编辑上下文已经迁移到 Topics 页面，发起页只负责组装。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <StatusBadge tone={topicReady ? 'success' : 'warning'}>{selectedTopic ? '1 selected' : '未选择'}</StatusBadge>
              <Link href="/topics" className="ui-action-button ui-action-secondary">
                去补 Topic
              </Link>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {topics.length > 0 ? (
              topics.map((topic) => {
                const checked = debateDraft.topicId === topic.id;

                return (
                  <button
                    key={topic.id}
                    type="button"
                    onClick={() => setDebateDraft((current) => ({ ...current, topicId: topic.id }))}
                    className={cx(
                      'w-full rounded-[24px] border px-4 py-4 text-left transition',
                      checked ? 'border-cyan-300/30 bg-cyan-300/10' : 'border-white/8 bg-white/4 hover:bg-white/6'
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-white">{topic.title}</div>
                        <div className="mt-2 text-xs leading-6 text-white/44">{topic.description.slice(0, 160)}</div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <StatusBadge>{topic.attachments.length} attachments</StatusBadge>
                          <StatusBadge>{topic.winnerRule}</StatusBadge>
                          <StatusBadge>{topic.maxRounds} rounds</StatusBadge>
                        </div>
                      </div>
                      <StatusBadge tone={checked ? 'info' : 'neutral'}>{checked ? 'selected' : 'idle'}</StatusBadge>
                    </div>
                  </button>
                );
              })
            ) : (
              <EmptyState className="text-left">
                当前还没有 Topic。先去 Topics 页面创建一个可复用议题，再回来继续组装。
              </EmptyState>
            )}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <ActionButton variant="secondary" onClick={() => setActiveStep('agent')}>
              返回上一步
            </ActionButton>
            <ActionButton variant="primary" onClick={() => setActiveStep('launch')} disabled={!debateDraft.topicId}>
              下一步：确认发起
            </ActionButton>
          </div>
        </SurfaceCard>
      );
    }

    return (
      <SurfaceCard tone="strong" className="rounded-[30px] px-5 py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-white/34">Step 3</div>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-white">确认并发起</h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--text-soft)]">
              现在页面只剩最终组装与确认，不再同时塞入 Agent 与 Topic 的复杂编辑器。
            </p>
          </div>
          <StatusBadge tone={launchReady ? 'success' : 'warning'}>{launchReady ? 'ready to launch' : 'still missing context'}</StatusBadge>
        </div>

        {!launchReady ? (
          <EmptyState className="mt-5 text-left">
            当前还不能直接发起辩论。至少需要 2 个 Agent，并且选中 1 个 Topic。
          </EmptyState>
        ) : null}

        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
          <SurfaceCard tone="soft" className="rounded-[24px] px-4 py-4">
            <div className="text-xs uppercase tracking-[0.18em] text-white/34">Selected Topic</div>
            {selectedTopic ? (
              <>
                <div className="mt-3 text-lg font-semibold text-white">{selectedTopic.title}</div>
                <div className="mt-3 text-sm leading-7 text-white/58">{selectedTopic.description}</div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <StatusBadge>{selectedTopic.attachments.length} attachments</StatusBadge>
                  <StatusBadge>{selectedTopic.winnerRule}</StatusBadge>
                  <StatusBadge>{selectedTopic.maxRounds} rounds</StatusBadge>
                </div>
              </>
            ) : (
              <EmptyState className="mt-4 text-left">还没有选择 Topic。</EmptyState>
            )}
          </SurfaceCard>

          <SurfaceCard tone="soft" className="rounded-[24px] px-4 py-4">
            <div className="text-xs uppercase tracking-[0.18em] text-white/34">Selected Agents</div>
            <div className="mt-3 space-y-3">
              {selectedAgents.length > 0 ? (
                selectedAgents.map((agent) => (
                  <div key={agent.id} className="rounded-[20px] border border-white/8 bg-white/4 px-4 py-4">
                    <div className="text-sm font-semibold text-white">{agent.name}</div>
                    <div className="mt-2 text-xs leading-6 text-white/44">{agent.description || '未填写角色说明'}</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <StatusBadge>{agent.modelDisplayName || '系统默认模型'}</StatusBadge>
                      {agent.stanceTags.length > 0 ? <StatusBadge tone="info">{agent.stanceTags.join(' · ')}</StatusBadge> : null}
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState className="text-left">还没有选择足够的 Agent。</EmptyState>
              )}
            </div>
          </SurfaceCard>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <MetricTile label="Agent Count" value={debateDraft.agentIds.length} detail="需满足 2 到 4 个角色" />
          <MetricTile label="Topic Ready" value={selectedTopic ? 'Yes' : 'No'} detail={selectedTopic ? selectedTopic.title : '尚未选择 Topic'} />
          <MetricTile label="Launch State" value={launchReady ? 'Ready' : 'Pending'} detail={launchReady ? '点击按钮即可进入工作台' : '补齐上下文后才可发起'} />
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <ActionButton variant="secondary" onClick={() => setActiveStep('topic')}>
            返回上一步
          </ActionButton>
          <ActionButton variant="primary" onClick={() => void handleCreateDebate()} disabled={pending || !launchReady}>
            {pending ? '创建中...' : '进入实时辩论工作台'}
          </ActionButton>
        </div>
      </SurfaceCard>
    );
  }

  return (
    <AppShell
      viewer={viewer}
      activeNav="launch"
      eyebrow="Launch / Guided Flow"
      title="发起页现在只负责“选择与组装”，而不再和首页一起承担所有编辑责任。"
      description="这是新的一步式工作流：先选 Agent，再选 Topic，最后确认发起。资源创建已经迁移到各自独立页面，所以这里的认知负担会轻很多。"
      actions={
        <>
          <Link href="/agents" className="ui-action-button ui-action-secondary">
            管理 Agent
          </Link>
          <Link href="/topics" className="ui-action-button ui-action-secondary">
            管理 Topic
          </Link>
        </>
      }
    >
      <div className="space-y-6">
        {error ? (
          <SurfaceCard className="rounded-[24px] border-rose-400/30 bg-rose-400/10 px-4 py-4 text-sm text-rose-100">
            {error}
          </SurfaceCard>
        ) : null}

        <section className="grid gap-4 xl:grid-cols-3">
          {steps.map((step, index) => (
            <button
              key={step.key}
              type="button"
              onClick={() => setActiveStep(step.key)}
              className={cx(
                'rounded-[28px] border px-5 py-5 text-left transition',
                activeStep === step.key ? 'border-cyan-300/30 bg-cyan-300/10' : 'border-white/8 bg-white/4 hover:bg-white/6'
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-white/34">0{index + 1}</div>
                  <div className="mt-3 text-lg font-semibold text-white">{step.title}</div>
                </div>
                <StatusBadge tone={stepTone(step.status)}>{step.status}</StatusBadge>
              </div>
              <div className="mt-3 text-sm leading-7 text-white/56">{step.description}</div>
              <ProgressMeter className="mt-4" value={step.value} max={step.max} />
            </button>
          ))}
        </section>

        {renderStepPanel()}
      </div>
    </AppShell>
  );
}
