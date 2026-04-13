import { z } from 'zod';

import { parseJsonBody, withRoute } from '@/lib/http/route';
import { ok } from '@/lib/http/response';
import { favoriteTurnService } from '@/server/services/debate.service';

const favoriteSchema = z.object({
  note: z.string().max(2000).optional(),
});

export async function POST(request: Request, context: { params: Promise<{ turnId: string }> }) {
  return withRoute(async () => {
    const { turnId } = await context.params;
    const body = await parseJsonBody(request, favoriteSchema);
    const favorite = await favoriteTurnService({
      note: body.note,
      turnId,
    });
    return ok({ favorited: true, favorite }, 'favorited');
  });
}
