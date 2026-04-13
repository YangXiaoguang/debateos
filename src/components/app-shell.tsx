'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { ReactNode } from 'react';

import { ActionButton, FrameShell, PageCanvas, StatusBadge, SurfaceCard, cx } from '@/components/ui/console-kit';
import { requestJson } from '@/lib/client/request-json';
import type { AppUserProfile } from '@/types/domain';

type AppNavKey = 'home' | 'agents' | 'topics' | 'launch' | 'debates' | 'reports' | 'models';

const PRIMARY_NAV: Array<{ key: AppNavKey; href: string; label: string; hint: string }> = [
  { key: 'home', href: '/', label: '工作台', hint: '总览与继续工作' },
  { key: 'agents', href: '/agents', label: 'Agents', hint: '角色与模型绑定' },
  { key: 'topics', href: '/topics', label: 'Topics', hint: '议题与附件上下文' },
  { key: 'launch', href: '/launch', label: 'Launch', hint: '组装并发起辩论' },
  { key: 'debates', href: '/debates', label: 'Debates', hint: '进行中与历史会话' },
  { key: 'reports', href: '/reports', label: 'Reports', hint: '归档、结论与复盘' },
];

const SECONDARY_NAV: Array<{ key: AppNavKey; href: string; label: string; hint: string }> = [
  { key: 'models', href: '/settings/models', label: '模型管理', hint: 'Provider、Key 与治理' },
];

function AppSidebarLink({
  href,
  label,
  hint,
  active,
}: {
  href: string;
  label: string;
  hint: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cx(
        'group relative flex items-center gap-3 rounded-[20px] border px-4 py-3 transition',
        active
          ? 'border-cyan-300/28 bg-cyan-300/10 text-white'
          : 'border-transparent bg-transparent text-white/66 hover:border-white/8 hover:bg-white/5 hover:text-white/92'
      )}
    >
      <span
        className={cx(
          'h-2.5 w-2.5 rounded-full transition',
          active ? 'bg-cyan-200 shadow-[0_0_18px_rgba(103,232,249,0.55)]' : 'bg-white/18 group-hover:bg-white/38'
        )}
      />
      <span className="min-w-0">
        <span className="block text-sm font-semibold tracking-[-0.02em]">{label}</span>
        <span className="mt-0.5 block text-xs leading-5 text-white/40">{hint}</span>
      </span>
    </Link>
  );
}

export function AppShell({
  viewer,
  activeNav,
  eyebrow,
  title,
  description,
  actions,
  children,
}: {
  viewer: AppUserProfile;
  activeNav: AppNavKey;
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const router = useRouter();
  const [pendingSignOut, setPendingSignOut] = useState(false);

  async function handleSignOut() {
    setPendingSignOut(true);

    try {
      await requestJson('/api/v1/auth/sign-out', { method: 'POST' });
      router.replace('/sign-in');
      router.refresh();
    } finally {
      setPendingSignOut(false);
    }
  }

  return (
    <PageCanvas className="p-3 md:p-5">
      <FrameShell className="mx-auto min-h-[calc(100vh-2rem)] max-w-[1680px] rounded-[32px]">
        <div className="grid min-h-[calc(100vh-2rem)] lg:grid-cols-[248px_minmax(0,1fr)]">
          <aside className="border-b border-white/10 bg-[rgba(7,12,22,0.9)] px-4 py-5 lg:border-b-0 lg:border-r lg:px-5 lg:py-6">
            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[22px] border border-cyan-300/20 bg-cyan-300/10 text-sm font-semibold tracking-[0.24em] text-cyan-100"
              >
                DO
              </Link>
              <div className="min-w-0">
                <div className="text-sm font-semibold tracking-[-0.03em] text-white">DebateOS</div>
                <div className="mt-1 text-xs leading-5 text-white/42">多 Agent 辩论工作系统</div>
              </div>
            </div>

            <div className="mt-8">
              <div className="text-[11px] uppercase tracking-[0.24em] text-white/32">Workspace</div>
              <nav className="mt-3 space-y-2">
                {PRIMARY_NAV.map((item) => (
                  <AppSidebarLink key={item.key} href={item.href} label={item.label} hint={item.hint} active={activeNav === item.key} />
                ))}
              </nav>
            </div>

            {viewer.role === 'admin' ? (
              <div className="mt-8">
                <div className="text-[11px] uppercase tracking-[0.24em] text-white/32">Admin</div>
                <nav className="mt-3 space-y-2">
                  {SECONDARY_NAV.map((item) => (
                    <AppSidebarLink key={item.key} href={item.href} label={item.label} hint={item.hint} active={activeNav === item.key} />
                  ))}
                </nav>
              </div>
            ) : null}

            <SurfaceCard tone="strong" className="mt-8 rounded-[24px] px-4 py-4 lg:mt-10">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-white">{viewer.name || viewer.email}</div>
                  <div className="mt-1 text-xs leading-5 text-white/40">{viewer.email}</div>
                </div>
                <StatusBadge tone={viewer.role === 'admin' ? 'info' : 'neutral'}>{viewer.role}</StatusBadge>
              </div>
              <ActionButton
                className="mt-4 w-full justify-center rounded-full"
                onClick={() => void handleSignOut()}
                disabled={pendingSignOut}
              >
                {pendingSignOut ? '退出中...' : '退出登录'}
              </ActionButton>
            </SurfaceCard>
          </aside>

          <div className="flex min-h-0 flex-col bg-[rgba(11,18,31,0.86)]">
            <header className="border-b border-white/8 px-5 py-6 md:px-7">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
                <div className="min-w-0">
                  {eyebrow ? <div className="text-[11px] uppercase tracking-[0.26em] text-white/36">{eyebrow}</div> : null}
                  <h1 className="mt-3 max-w-4xl text-3xl font-semibold tracking-[-0.04em] text-white md:text-4xl">{title}</h1>
                  {description ? <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--text-soft)]">{description}</p> : null}
                </div>
                {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
              </div>
            </header>

            <div className="flex-1 px-5 py-6 md:px-7 md:py-7">{children}</div>
          </div>
        </div>
      </FrameShell>
    </PageCanvas>
  );
}
