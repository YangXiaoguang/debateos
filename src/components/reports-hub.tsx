'use client';

import Link from 'next/link';
import { useDeferredValue, useState } from 'react';

import { AppShell } from '@/components/app-shell';
import { EmptyState, MetricTile, StatusBadge, SurfaceCard, TextInput, cx } from '@/components/ui/console-kit';
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

function reportSummary(session: DebateSessionListItem) {
  return session.summary || session.topicDescription;
}

export function ReportsHub({ initialData }: { initialData: DashboardSnapshot }) {
  const { viewer } = initialData;
  const completedSessions = initialData.sessions.filter((session) => session.status === 'completed');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(completedSessions[0]?.id ?? '');
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());

  const filteredReports = completedSessions.filter((session) => {
    if (!deferredSearch) return true;
    return (
      session.topicTitle.toLowerCase().includes(deferredSearch) ||
      reportSummary(session).toLowerCase().includes(deferredSearch)
    );
  });

  const selectedReport =
    filteredReports.find((session) => session.id === selectedId) ??
    filteredReports[0] ??
    completedSessions.find((session) => session.id === selectedId) ??
    null;

  return (
    <AppShell
      viewer={viewer}
      activeNav="reports"
      eyebrow="Reports / Archive"
      title="结果归档终于从运行态里分离出来了，复盘时不再被实时操作信息打断。"
      description="Reports 页面现在只处理已完成会话的结果、摘要和回看入口。实时推进请去 Debates，发起新任务请去 Launch。"
      actions={
        <>
          <Link href="/debates" className="ui-action-button ui-action-secondary">
            回到 Debates
          </Link>
          <Link href="/launch" className="ui-action-button ui-action-primary">
            发起新辩论
          </Link>
        </>
      }
    >
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <MetricTile label="Completed" value={completedSessions.length} detail="已完成并进入归档的会话" />
          <MetricTile label="Reported" value={completedSessions.filter((session) => Boolean(session.summary)).length} detail="已写入摘要的会话" />
          <MetricTile label="Latest Archive" value={completedSessions[0] ? formatTimestamp(completedSessions[0].updatedAt) : '暂无'} detail="最近一次归档时间" />
        </div>

        <div className="grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
          <SurfaceCard className="rounded-[30px] px-5 py-5">
            <div className="text-xs uppercase tracking-[0.2em] text-white/34">Archive List</div>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-white">结果列表</h2>
            <TextInput
              className="mt-5"
              placeholder="搜索标题或摘要"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />

            <div className="mt-5 space-y-3">
              {filteredReports.length > 0 ? (
                filteredReports.map((session) => (
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
                        <div className="mt-2 text-xs leading-6 text-white/44">{reportSummary(session).slice(0, 110)}</div>
                      </div>
                      <StatusBadge tone="success">completed</StatusBadge>
                    </div>
                    <div className="mt-3 text-[11px] text-white/34">{formatTimestamp(session.updatedAt)}</div>
                  </button>
                ))
              ) : (
                <EmptyState className="text-left">还没有已完成会话可供归档展示。</EmptyState>
              )}
            </div>
          </SurfaceCard>

          <SurfaceCard tone="strong" className="rounded-[30px] px-5 py-5">
            <div className="text-xs uppercase tracking-[0.2em] text-white/34">Report Detail</div>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-white">归档详情</h2>

            {selectedReport ? (
              <div className="mt-5 space-y-5">
                <div className="flex flex-wrap gap-2">
                  <StatusBadge tone="success">completed</StatusBadge>
                  <StatusBadge>{selectedReport.participantCount} agents</StatusBadge>
                  <StatusBadge>{formatTimestamp(selectedReport.updatedAt)}</StatusBadge>
                </div>

                <div>
                  <div className="text-xl font-semibold text-white">{selectedReport.topicTitle}</div>
                  <div className="mt-3 text-sm leading-7 text-[var(--text-soft)]">{selectedReport.topicDescription}</div>
                </div>

                <SurfaceCard tone="soft" className="rounded-[24px] px-4 py-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-white/34">Summary</div>
                  <div className="mt-3 text-sm leading-7 text-white/62">{reportSummary(selectedReport)}</div>
                </SurfaceCard>

                <div className="grid gap-4 md:grid-cols-2">
                  <MetricTile label="Finished At" value={selectedReport.completedAt ? formatTimestamp(selectedReport.completedAt) : '未知'} detail="会话完成时间" />
                  <MetricTile label="Current Phase" value={selectedReport.currentPhase || 'closed'} detail="归档时阶段" />
                </div>

                <div className="flex flex-wrap gap-3">
                  <Link href={`/debates/${selectedReport.id}`} className="ui-action-button ui-action-primary">
                    打开完整记录
                  </Link>
                  <Link href="/launch" className="ui-action-button ui-action-secondary">
                    再发起一场
                  </Link>
                </div>
              </div>
            ) : (
              <EmptyState className="mt-5 text-left">
                目前没有可展示的归档结果。完成一场辩论后，这里会成为你查看总结和回放的主入口。
              </EmptyState>
            )}
          </SurfaceCard>
        </div>
      </div>
    </AppShell>
  );
}
