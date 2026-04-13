import { withRoute } from '@/lib/http/route';
import { ensureDebateSessionExecution } from '@/server/services/debate-runtime.service';
import { getDebateWorkspaceService } from '@/server/services/debate.service';
import { subscribeToSession } from '@/server/runtime/session-broker';

export const runtime = 'nodejs';

function encodeEvent(type: string, data: unknown, id?: string) {
  const payload = JSON.stringify(data);
  const lines = [
    ...(id ? [`id: ${id}`] : []),
    `event: ${type}`,
    ...payload.split(/\r?\n/).map((line) => `data: ${line}`),
  ];

  return `${lines.join('\n')}\n\n`;
}

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  return withRoute(async () => {
    const { id } = await context.params;
    const snapshot = await getDebateWorkspaceService(id);

    let unsubscribe = () => {};
    let heartbeat: NodeJS.Timeout | undefined;

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder();

        controller.enqueue(encoder.encode(`: connected ${id}\n\n`));

        unsubscribe = subscribeToSession(id, (event) => {
          controller.enqueue(encoder.encode(encodeEvent(event.type, event.data, event.id)));
        });

        heartbeat = setInterval(() => {
          controller.enqueue(encoder.encode(': ping\n\n'));
        }, 15000);

        if (snapshot.session.status === 'running') {
          void ensureDebateSessionExecution(id);
        }
      },
      cancel() {
        unsubscribe();
        if (heartbeat) {
          clearInterval(heartbeat);
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  });
}
