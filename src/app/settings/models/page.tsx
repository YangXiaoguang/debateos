import { notFound } from 'next/navigation';

import { ModelRegistry } from '@/components/model-registry';
import { requirePageUser } from '@/server/auth/session.service';
import { listManagedModelsService } from '@/server/services/model.service';
import { mapUserProfile } from '@/server/services/view-mappers';

export const dynamic = 'force-dynamic';

export default async function ModelsPage() {
  const viewer = await requirePageUser();

  if (viewer.role !== 'admin') {
    notFound();
  }

  const models = await listManagedModelsService();

  return <ModelRegistry viewer={mapUserProfile(viewer)} initialModels={models} />;
}
