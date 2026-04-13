import { DebatesConsole } from '@/components/debates-console';
import { requirePageUser } from '@/server/auth/session.service';
import { getDashboardSnapshot } from '@/server/services/dashboard.service';

export const dynamic = 'force-dynamic';

export default async function DebatesPage() {
  await requirePageUser();
  const snapshot = await getDashboardSnapshot();
  return <DebatesConsole initialData={snapshot} />;
}
