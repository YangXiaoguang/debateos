'use client';

import Link from 'next/link';
import { useDeferredValue, useState } from 'react';

import { AppShell } from '@/components/app-shell';
import { EmptyState, MetricTile, StatusBadge, SurfaceCard, TextInput, cx } from '@/components/ui/console-kit';
import type { DashboardSnapshot, DebateSessionListItem, DebateSessionStatus } from '@/types/domain';

type SessionFilter = 'all' | 'running' | 'completed' | 'paused' | 'failed';

function formatTimestamp(value: string | null) {
  if (!value) return '刚刚';
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function sessionTone(status: DebateSessionStatus) {
  if (status === 'completed') return 'success' as const;
  if (status === 'running') return 'info' as const;
  if (status === 'paused') return 'warning' as const;
  if (status === 'failed' || status === 'aborted') return 'danger' as const;
  return 'neutral' as const;
}

export function DebatesConsole({ initialData }: { initialData: DashboardSnapshot }) {
  const { viewer } = initialData;
  const [sessions] = useState(initialData.sessions);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<SessionFilter>('all');
  const [selectedId, setSelectedId] = useState(initialData.sessions[0]?.id ?? '');
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());

  const filteredSessions = sessions.filter((session) => {
    const matchesFilter =
      filter === 'all'
        ? true
        : filter === 'failed'
          ? session.status === 'failed' || session.status === 'aborted'
          : session.status === filter;
    const matchesSearch =
      deferredSearch.length === 0 ||
      session.topicTitle.toLowerCase().includes(deferredSearch) ||
      session.topicDescription.toLowerCase().includes(deferredSearch);

    return matchesFilter && matchesSearch;
  });

  const selectedSession =
    filteredSessions.find((session) => session.id === selectedId) ??
    filteredSessions[0] ??
    sessions.find((session) => session.id === selectedId) ??
    null;

  return (
    <AppShell
      viewer={viewer}
      activeNav="debates"
      eyebrow="Debates / Session Center"
      title="会话管理现在有自己的页面，不再让首页被长列表和搜索流挤满。"
      description="这里专门管理进行中、暂停和历史辩论。首页只保留最近 3 条继续入口，完整列表与筛选统一回到 Debates 页面。"
      actions={
        <>
          <Link href="/launch" className="ui-action-button ui-action-primary">
            发起新辩论
          </Link>
          <Link href="/reports" className="ui-action-button ui-action-secondary">
            查看 Reports
          </Link>
        </>
      }
    >
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          <MetricTile label="All Sessions" value={sessions.length} detail="全部会话" />
          <MetricTile label="Running" value={sessions.filter((session) => session.status === 'running').length} detail="当前正在推进的辩论" />
          <MetricTile label="Completed" value={sessions.filter((session) => session.status === 'completed').length} detail="已进入结果归档的会话" />
          <MetricTile label="Paused" value={sessions.filter((session) => session.status === 'paused').length} detail="等待继续的会话" />
        </div>

        <div className="grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
          <SurfaceCard className="rounded-[30px] px-5 py-5">
            <div className="text-xs uppercase tracking-[0.2em] text-white/34">Filters</div>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-white">筛选与会话列表</h2>
            <TextInput
              className="mt-5"
              placeholder="按议题标题或描述搜索"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />

            <div className="mt-4 flex flex-wrap gap-2">
              {[
                ['all', '全部'],
                ['running', '进行中'],
                ['completed', '已完成'],
                ['paused', '已暂停'],
                ['failed', '异常/中断'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFilter(value as SessionFilter)}
                  className={cx(
                    'rounded-full border px-3 py-2 text-xs transition',
                    filter === value ? 'border-cyan-300/30 bg-cyan-300/10 text-cyan-100' : 'border-white/10 bg-white/4 text-white/66'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="mt-5 space-y-3">
              {filteredSessions.length > 0 ? (
                filteredSessions.map((session) => (
                  <button
                    key={session.id}
                    type="button"
                    onClick={() => setSelectedId(session.id)}
                    className={cx(
                      'w-full rounded-[24px] border px-4 py-4 text-left transition',
                      selectedId === session.id ? 'border-cyan-300/30 bg-cyan-300/10' : 'border-white/8 bg-white/4 hover:bg-white/6'
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-white">{session.topicTitle}</div>
                        <div className="mt-2 text-xs leading-6 text-white/44">{session.topicDescription.slice(0, 110)}</div>
                      </div>
                      <StatusBadge tone={sessionTone(session.status)}>{session.status}</StatusBadge>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-white/34">
                      <span>{session.participantCount} agents</span>
                      <span>{formatTimestamp(session.updatedAt)}</span>
                    </div>
                  </button>
                ))
              ) : (
                <EmptyState className="text-left">没有匹配的会话。你可以换一个筛选条件，或直接发起新辩论。</EmptyState>
              )}
            </div>
          </SurfaceCard>

          <SurfaceCard tone="strong" className="rounded-[30px] px-5 py-5">
            <div className="text-xs uppercase tracking-[0.2em] text-white/34">Session Detail</div>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-white">会话详情</h2>

            {selectedSession ? (
              <div className="mt-5 space-y-5">
                <div className="flex flex-wrap gap-2">
                  <StatusBadge tone={sessionTone(selectedSession.status)}>{selectedSession.status}</StatusBadge>
                  <StatusBadge>{selectedSession.participantCount} agents</StatusBadge>
                  <StatusBadge>{selectedSession.currentPhase || 'waiting'}</StatusBadge>
                  <StatusBadge>Round {selectedSession.currentRoundNo}</StatusBadge>
                </div>

                <div>
                  <div className="text-xl font-semibold text-white">{selectedSession.topicTitle}</div>
                  <div className="mt-3 text-sm leading-7 text-[var(--text-soft)]">{selectedSession.topicDescription}</div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <MetricTile label="Updated" value={formatTimestamp(selectedSession.updatedAt)} detail="最近更新时间" />
                  <MetricTile label="Started" value={selectedSession.startedAt ? formatTimestamp(selectedSession.startedAt) : '未开始'} detail="首次开始时间" />
                  <MetricTile label="Paused" value={selectedSession.pausedAt ? formatTimestamp(selectedSession.pausedAt) : '未暂停'} detail="暂停状态" />
                  <MetricTile label="Completed" value={selectedSession.completedAt ? formatTimestamp(selectedSession.completedAt) : '未完成'} detail="结果归档时间" />
                </div>

                <SurfaceCard tone="soft" className="rounded-[24px] px-4 py-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-white/34">Summary</div>
                  <div className="mt-3 text-sm leading-7 text-white/60">
                    {selectedSession.summary || '当前还没有可展示的会话摘要。实时辩论推进后，这里会出现阶段性结论。'}
                  </div>
                </SurfaceCard>

                <div className="flex flex-wrap gap-3">
                  <Link href={`/debates/${selectedSession.id}`} className="ui-action-button ui-action-primary">
                    打开工作台
                  </Link>
                  <Link href="/launch" className="ui-action-button ui-action-secondary">
                    再发起一场
                  </Link>
                </div>
              </div>
            ) : (
              <EmptyState className="mt-5 text-left">
                当前没有可展示的会话详情。先去发起页启动一场新的辩论。
              </EmptyState>
            )}
          </SurfaceCard>
        </div>
      </div>
    </AppShell>
  );
}
