import 'server-only';

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { invariant } from '@/lib/http/route';
import { getTopicById } from '@/server/repositories/topic.repository';
import { createTopicAttachments, listTopicAttachmentsByTopicId } from '@/server/repositories/attachment.repository';
import { ensureOwnerAccess, requireCurrentUser } from '@/server/auth/session.service';
import { extractAttachmentContent } from '@/server/services/attachment-parser.service';
import { mapTopicAttachmentView } from '@/server/services/view-mappers';

function sanitizeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'file';
}

function resolvePublicUploadRoot() {
  return path.join(process.cwd(), 'public', 'uploads', 'topics');
}

async function saveTopicFile(topicId: string, file: File) {
  const directory = path.join(resolvePublicUploadRoot(), topicId);
  await mkdir(directory, { recursive: true });

  const name = sanitizeSegment(file.name);
  const extension = path.extname(name);
  const base = sanitizeSegment(path.basename(name, extension));
  const finalName = `${Date.now()}-${base}${extension}`;
  const targetPath = path.join(directory, finalName);

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(targetPath, buffer);

  return {
    buffer,
    publicUrl: `/uploads/topics/${topicId}/${finalName}`,
  };
}

export async function uploadTopicAttachmentsService(topicId: string, files: File[]) {
  const viewer = await requireCurrentUser();
  const topic = await getTopicById(topicId);
  invariant(topic, 'TOPIC_NOT_FOUND', 'Topic not found.', 404);
  ensureOwnerAccess(topic.ownerUserId, viewer.id);
  invariant(files.length > 0, 'INVALID_REQUEST', 'Please attach at least one file.', 400);

  const rows = [];

  for (const file of files) {
    const { buffer, publicUrl } = await saveTopicFile(topicId, file);
    const extraction = await extractAttachmentContent(file, buffer);
    rows.push({
      topicId,
      fileName: file.name,
      fileType: file.type || null,
      fileSize: file.size,
      fileUrl: publicUrl,
      extractedText: extraction.extractedText,
      metadata: {
        lastModified: file.lastModified,
        ...extraction.metadata,
      },
    } satisfies Parameters<typeof createTopicAttachments>[0][number]);
  }

  const created = await createTopicAttachments(rows);
  return created.map(mapTopicAttachmentView);
}

export async function listTopicAttachmentsService(topicId: string) {
  const viewer = await requireCurrentUser();
  const topic = await getTopicById(topicId);
  invariant(topic, 'TOPIC_NOT_FOUND', 'Topic not found.', 404);
  ensureOwnerAccess(topic.ownerUserId, viewer.id);

  const attachments = await listTopicAttachmentsByTopicId(topicId);
  return attachments.map(mapTopicAttachmentView);
}
