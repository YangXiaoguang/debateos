import { DashboardShell } from '@/components/dashboard-shell';
import { EmptyState, Eyebrow, FrameShell, PageCanvas, SurfaceCard } from '@/components/ui/console-kit';
import { requirePageUser } from '@/server/auth/session.service';
import { getDashboardSnapshot } from '@/server/services/dashboard.service';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  await requirePageUser();

  try {
    const snapshot = await getDashboardSnapshot();
    return <DashboardShell initialData={snapshot} />;
  } catch (error) {
    return (
      <PageCanvas className="flex items-center justify-center px-6">
        <FrameShell className="w-full max-w-3xl rounded-[34px]">
          <SurfaceCard tone="accent" className="rounded-[34px] px-8 py-8">
            <Eyebrow>DebateOS Setup</Eyebrow>
            <h1 className="mt-4 text-3xl font-semibold tracking-[-0.03em]">数据库或依赖尚未就绪，Dashboard 暂时无法读取真实数据。</h1>
            <p className="mt-4 text-sm leading-7 text-[var(--text-soft)]">
              {error instanceof Error ? error.message : 'Unknown bootstrap error.'}
            </p>
            <EmptyState className="mt-6 text-left">
              把依赖安装完成、创建 `.env.local` 并指向 PostgreSQL 后，页面会自动切换成完整的 DebateOS 控制台。
            </EmptyState>
          </SurfaceCard>
        </FrameShell>
      </PageCanvas>
    );
  }
}
