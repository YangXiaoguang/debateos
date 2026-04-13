import Link from 'next/link';

import { AppShell } from '@/components/app-shell';
import { ActionButton, EmptyState, MetricTile, ProgressMeter, StatusBadge, SurfaceCard } from '@/components/ui/console-kit';
import type { DashboardSnapshot, DebateSessionListItem } from '@/types/domain';

function formatTimestamp(value: string | null) {
  if (!value) return '刚刚';
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function sessionTone(status: DebateSessionListItem['status']) {
  if (status === 'completed') return 'success' as const;
  if (status === 'running') return 'info' as const;
  if (status === 'failed' || status === 'aborted') return 'danger' as const;
  if (status === 'paused') return 'warning' as const;
  return 'neutral' as const;
}

function recommendedRoute(agentCount: number, topicCount: number) {
  if (agentCount < 2) return '/agents' as const;
  if (topicCount < 1) return '/topics' as const;
  return '/launch' as const;
}

function routeLabel(route: ReturnType<typeof recommendedRoute>) {
  if (route === '/agents') return '先准备 Agent 阵容';
  if (route === '/topics') return '先定义 Topic';
  return '可以直接发起新辩论';
}

function latestTimestamp(values: string[]) {
  const sorted = [...values].sort((left, right) => new Date(right).getTime() - new Date(left).getTime());
  return sorted[0] ?? null;
}

export function DashboardShell({ initialData }: { initialData: DashboardSnapshot }) {
  const { viewer, agents, topics, sessions, models } = initialData;
  const modelsReadyCount = models.filter((model) => model.credentialStatus !== 'missing' || model.transport === 'mock').length;
  const runningCount = sessions.filter((session) => session.status === 'running').length;
  const completedCount = sessions.filter((session) => session.status === 'completed').length;
  const recentSessions = sessions.slice(0, 3);
  const primaryRoute = recommendedRoute(agents.length, topics.length);
  const latestSession = sessions[0] ?? null;

  const resourceCards = [
    {
      title: 'Agent 阵容',
      description: '定义角色差异、绑定模型和表达风格，为后续攻防拉开声音层次。',
      value: agents.length,
      target: '/agents' as const,
      action: agents.length > 0 ? '管理 Agent' : '创建第一个 Agent',
      progressValue: Math.min(agents.length, 2),
      progressMax: 2,
      detail: agents.length >= 2 ? '已满足发起辩论的最低阵容要求。' : '建议先准备至少 2 个差异化 Agent。',
      updatedAt: latestTimestamp(agents.map((agent) => agent.updatedAt)),
    },
    {
      title: 'Topic 资产',
      description: '把议题描述、附件和胜负规则打包成可复用任务模板。',
      value: topics.length,
      target: '/topics' as const,
      action: topics.length > 0 ? '管理 Topic' : '创建第一个 Topic',
      progressValue: Math.min(topics.length, 1),
      progressMax: 1,
      detail: topics.length > 0 ? '至少已经有一个可直接发起的辩题。' : '建议尽快沉淀第一个可复用 Topic。',
      updatedAt: latestTimestamp(topics.map((topic) => topic.updatedAt)),
    },
    {
      title: '辩论发起',
      description: '从准备好的 Agent 与 Topic 中组装阵容，并进入实时辩论工作台。',
      value: sessions.length,
      target: '/launch' as const,
      action: agents.length >= 2 && topics.length >= 1 ? '开始新辩论' : '查看发起向导',
      progressValue: Number(agents.length >= 2) + Number(topics.length >= 1),
      progressMax: 2,
      detail: agents.length >= 2 && topics.length >= 1 ? '资源已基本就绪，可以直接进入发起向导。' : '先补齐 Agent 与 Topic，再进入组装步骤。',
      updatedAt: latestTimestamp(sessions.map((session) => session.updatedAt)),
    },
  ];

  return (
    <AppShell
      viewer={viewer}
      activeNav="home"
      eyebrow="Home / Workspace"
      title="把 DebateOS 首页收回到“当前状态 + 下一步动作”，而不是把所有事情都塞进首屏。"
      description="这里现在只负责告诉你资源准备到哪、最近有哪些会话可以继续，以及下一步最值得做什么。完整创建和管理动作已经迁移到独立页面。"
      actions={
        <>
          <Link href={primaryRoute} className="ui-action-button ui-action-primary">
            {routeLabel(primaryRoute)}
          </Link>
          {latestSession ? (
            <Link href={`/debates/${latestSession.id}`} className="ui-action-button ui-action-secondary">
              继续最近会话
            </Link>
          ) : (
            <Link href="/launch" className="ui-action-button ui-action-secondary">
              打开发起向导
            </Link>
          )}
        </>
      }
    >
      <div className="space-y-6">
        <SurfaceCard tone="accent" className="rounded-[30px] px-6 py-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl">
              <div className="text-sm font-medium text-cyan-100/88">当前建议</div>
              <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-white md:text-[2rem]">{routeLabel(primaryRoute)}</h2>
              <p className="mt-3 text-sm leading-7 text-[var(--text-soft)]">
                {primaryRoute === '/agents'
                  ? '你现在最缺的是角色阵容。先把立场、风格和模型绑定拉开，后面的 Topic 和 Launch 才会更顺。'
                  : primaryRoute === '/topics'
                    ? '角色已经差不多就绪，下一步应该把议题描述、约束条件和附件材料整理成可复用 Topic。'
                    : '基础资源已经到位，可以直接进入向导组装阵容并发起一场新的多 Agent 辩论。'}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:w-[380px]">
              <MetricTile label="Running" value={runningCount} detail="当前进行中的辩论" />
              <MetricTile label="Completed" value={completedCount} detail="已完成的会话" />
              <MetricTile label="Models Ready" value={modelsReadyCount} detail={`${models.length} 个活跃模型中可直接使用的数量`} />
              <MetricTile label="Viewer" value={viewer.role === 'admin' ? 'Admin' : 'User'} detail={viewer.name || viewer.email} />
            </div>
          </div>
        </SurfaceCard>

        <section className="grid gap-5 xl:grid-cols-3">
          {resourceCards.map((card) => (
            <SurfaceCard key={card.title} className="rounded-[28px] px-5 py-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-white/34">Resource</div>
                  <h3 className="mt-3 text-xl font-semibold tracking-[-0.03em] text-white">{card.title}</h3>
                </div>
                <StatusBadge tone="info">{card.value}</StatusBadge>
              </div>
              <p className="mt-4 text-sm leading-7 text-[var(--text-soft)]">{card.description}</p>
              <div className="mt-5">
                <ProgressMeter value={card.progressValue} max={card.progressMax} />
                <div className="mt-3 text-xs leading-6 text-white/44">{card.detail}</div>
                <div className="mt-2 text-[11px] text-white/32">
                  {card.updatedAt ? `最近更新于 ${formatTimestamp(card.updatedAt)}` : '还没有历史变更'}
                </div>
              </div>
              <Link href={card.target} className="ui-action-button ui-action-secondary mt-5">
                {card.action}
              </Link>
            </SurfaceCard>
          ))}
        </section>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_360px]">
          <SurfaceCard className="rounded-[30px] px-6 py-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-white/34">Recent Sessions</div>
                <h3 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-white">最近会话</h3>
              </div>
              <Link href="/debates" className="ui-action-button ui-action-ghost">
                查看全部会话
              </Link>
            </div>

            <div className="mt-5 space-y-3">
              {recentSessions.length > 0 ? (
                recentSessions.map((session) => (
                  <SurfaceCard key={session.id} tone="soft" className="rounded-[24px] px-4 py-4">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-white">{session.topicTitle}</div>
                        <div className="mt-2 text-sm leading-7 text-white/58">{session.topicDescription.slice(0, 120)}</div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <StatusBadge tone={sessionTone(session.status)}>{session.status}</StatusBadge>
                          <StatusBadge>{session.participantCount} agents</StatusBadge>
                          <StatusBadge>{formatTimestamp(session.updatedAt)}</StatusBadge>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        <Link href={`/debates/${session.id}`} className="ui-action-button ui-action-primary">
                          {session.status === 'completed' ? '查看结果' : '继续会话'}
                        </Link>
                        <Link href="/launch" className="ui-action-button ui-action-secondary">
                          再次发起
                        </Link>
                      </div>
                    </div>
                  </SurfaceCard>
                ))
              ) : (
                <EmptyState className="text-left">
                  当前还没有会话记录。先准备 Agent 和 Topic，再从发起向导进入第一场辩论。
                  <div className="mt-4">
                    <Link href={primaryRoute} className="ui-action-button ui-action-primary">
                      前往下一步
                    </Link>
                  </div>
                </EmptyState>
              )}
            </div>
          </SurfaceCard>

          <SurfaceCard className="rounded-[30px] px-5 py-5">
            <div className="text-xs uppercase tracking-[0.2em] text-white/34">System Snapshot</div>
            <h3 className="mt-3 text-xl font-semibold tracking-[-0.03em] text-white">系统摘要</h3>
            <div className="mt-5 grid gap-3">
              <MetricTile label="Agents" value={agents.length} detail={agents.length > 0 ? '角色池已建立' : '等待首个 Agent'} />
              <MetricTile label="Topics" value={topics.length} detail={topics.length > 0 ? '已有可复用辩题' : '等待首个 Topic'} />
              <MetricTile label="Sessions" value={sessions.length} detail={runningCount > 0 ? `${runningCount} 个正在运行` : '当前没有进行中的会话'} />
              <MetricTile label="Models" value={models.length} detail={modelsReadyCount > 0 ? `${modelsReadyCount} 个模型已就绪` : '请先完成模型配置'} />
            </div>

            <div className="mt-5 rounded-[24px] border border-white/8 bg-white/4 px-4 py-4">
              <div className="text-sm font-semibold text-white">推荐工作流</div>
              <div className="mt-3 space-y-3 text-sm leading-7 text-white/58">
                <p>1. 在资源页分别把 Agent 与 Topic 整理成稳定资产，不要把复杂编辑器继续堆在首页。</p>
                <p>2. 发起页只负责“选择与组装”，这样任务路径会明显更顺，也更适合新用户理解。</p>
                <p>3. Debates 与 Reports 分开后，运行中任务和复盘结果的阅读负担会大幅下降。</p>
              </div>
            </div>
          </SurfaceCard>
        </div>
      </div>
    </AppShell>
  );
}
