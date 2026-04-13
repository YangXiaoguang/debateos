import { TopicsStudio } from '@/components/topics-studio';
import { requirePageUser } from '@/server/auth/session.service';
import { getDashboardSnapshot } from '@/server/services/dashboard.service';

export const dynamic = 'force-dynamic';

export default async function TopicsPage() {
  await requirePageUser();
  const snapshot = await getDashboardSnapshot();
  return <TopicsStudio initialData={snapshot} />;
}
