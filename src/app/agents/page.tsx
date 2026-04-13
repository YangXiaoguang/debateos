import { AgentsStudio } from '@/components/agents-studio';
import { requirePageUser } from '@/server/auth/session.service';
import { getDashboardSnapshot } from '@/server/services/dashboard.service';

export const dynamic = 'force-dynamic';

export default async function AgentsPage() {
  await requirePageUser();
  const snapshot = await getDashboardSnapshot();
  return <AgentsStudio initialData={snapshot} />;
}
