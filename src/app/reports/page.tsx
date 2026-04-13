import { ReportsHub } from '@/components/reports-hub';
import { requirePageUser } from '@/server/auth/session.service';
import { getDashboardSnapshot } from '@/server/services/dashboard.service';

export const dynamic = 'force-dynamic';

export default async function ReportsPage() {
  await requirePageUser();
  const snapshot = await getDashboardSnapshot();
  return <ReportsHub initialData={snapshot} />;
}
