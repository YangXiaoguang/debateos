import { withRoute } from '@/lib/http/route';
import { ok } from '@/lib/http/response';
import { listTopicAttachmentsService, uploadTopicAttachmentsService } from '@/server/services/attachment.service';

export const runtime = 'nodejs';

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  return withRoute(async () => {
    const { id } = await context.params;
    const attachments = await listTopicAttachmentsService(id);
    return ok(attachments);
  });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return withRoute(async () => {
    const { id } = await context.params;
    const formData = await request.formData();
    const files = formData
      .getAll('files')
      .filter((value): value is File => value instanceof File);
    const attachments = await uploadTopicAttachmentsService(id, files);
    return ok(attachments, 'uploaded');
  });
}
