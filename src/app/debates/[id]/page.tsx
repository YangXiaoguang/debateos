import { notFound } from 'next/navigation';

import { DebateWorkspace } from '@/components/debate-workspace';
import { requirePageUser } from '@/server/auth/session.service';
import { getDebateWorkspaceService } from '@/server/services/debate.service';

export const dynamic = 'force-dynamic';

export default async function DebatePage({ params }: { params: Promise<{ id: string }> }) {
  await requirePageUser();
  const { id } = await params;

  try {
    const snapshot = await getDebateWorkspaceService(id);
    return <DebateWorkspace initialSnapshot={snapshot} />;
  } catch {
    notFound();
  }
}
