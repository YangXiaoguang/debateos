import 'server-only';

import type { DashboardSnapshot } from '@/types/domain';
import { requireCurrentUser } from '@/server/auth/session.service';
import { listAgentsService } from '@/server/services/agent.service';
import { listDebatesService } from '@/server/services/debate.service';
import { listManagedModelsService } from '@/server/services/model.service';
import { listTopicsService } from '@/server/services/topic.service';
import { mapUserProfile } from '@/server/services/view-mappers';

export async function getDashboardSnapshot(): Promise<DashboardSnapshot> {
  const viewer = await requireCurrentUser();
  const [agents, topics, sessions, models] = await Promise.all([
    listAgentsService(),
    listTopicsService(),
    listDebatesService(),
    listManagedModelsService({ onlyActive: true }),
  ]);

  return {
    viewer: mapUserProfile(viewer),
    agents,
    topics,
    sessions,
    models,
  };
}
