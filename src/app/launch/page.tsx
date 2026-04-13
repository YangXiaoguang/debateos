import { LaunchStudio } from '@/components/launch-studio';
import { requirePageUser } from '@/server/auth/session.service';
import { getDashboardSnapshot } from '@/server/services/dashboard.service';

export const dynamic = 'force-dynamic';

export default async function LaunchPage() {
  await requirePageUser();
  const snapshot = await getDashboardSnapshot();
  return <LaunchStudio initialData={snapshot} />;
}
