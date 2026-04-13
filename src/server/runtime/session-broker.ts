import 'server-only';

import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';

import type { SessionStreamEvent, SessionStreamEventType } from '@/types/domain';

class SessionBroker {
  private readonly emitter = new EventEmitter();
  private readonly activeRuns = new Map<string, Promise<void>>();

  constructor() {
    this.emitter.setMaxListeners(200);
  }

  publish(sessionId: string, type: SessionStreamEventType, data: unknown) {
    const event: SessionStreamEvent = {
      id: randomUUID(),
      type,
      createdAt: new Date().toISOString(),
      data,
    };

    this.emitter.emit(sessionId, event);
    return event;
  }

  subscribe(sessionId: string, listener: (event: SessionStreamEvent) => void) {
    this.emitter.on(sessionId, listener);
    return () => {
      this.emitter.off(sessionId, listener);
    };
  }

  ensureRun(sessionId: string, factory: () => Promise<void>) {
    const existing = this.activeRuns.get(sessionId);
    if (existing) {
      return existing;
    }

    const run = factory().finally(() => {
      this.activeRuns.delete(sessionId);
    });

    this.activeRuns.set(sessionId, run);
    return run;
  }

  hasActiveRun(sessionId: string) {
    return this.activeRuns.has(sessionId);
  }
}

const globalForBroker = globalThis as unknown as {
  debateSessionBroker?: SessionBroker;
};

function getBroker() {
  if (!globalForBroker.debateSessionBroker) {
    globalForBroker.debateSessionBroker = new SessionBroker();
  }

  return globalForBroker.debateSessionBroker;
}

export function publishSessionEvent(sessionId: string, type: SessionStreamEventType, data: unknown) {
  return getBroker().publish(sessionId, type, data);
}

export function subscribeToSession(sessionId: string, listener: (event: SessionStreamEvent) => void) {
  return getBroker().subscribe(sessionId, listener);
}

export function ensureSessionRun(sessionId: string, factory: () => Promise<void>) {
  return getBroker().ensureRun(sessionId, factory);
}

export function hasActiveSessionRun(sessionId: string) {
  return getBroker().hasActiveRun(sessionId);
}
