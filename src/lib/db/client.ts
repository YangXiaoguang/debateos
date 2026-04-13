import 'server-only';

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import * as schema from './schema';

type CachedDbClient = ReturnType<typeof drizzle>;

const globalForDb = globalThis as unknown as {
  pool?: Pool;
  db?: CachedDbClient;
};

function getPool() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }

  const pool = globalForDb.pool ?? new Pool({ connectionString });

  if (process.env.NODE_ENV !== 'production') {
    globalForDb.pool = pool;
  }

  return pool;
}

export function getDb() {
  const existing = globalForDb.db;

  if (existing) {
    return existing;
  }

  const client = drizzle({ client: getPool(), schema });

  if (process.env.NODE_ENV !== 'production') {
    globalForDb.db = client;
  }

  return client;
}

export type DbClient = ReturnType<typeof getDb>;

export const db = new Proxy({} as DbClient, {
  get(_target, prop, receiver) {
    const client = getDb() as unknown as Record<PropertyKey, unknown>;
    const value = Reflect.get(client, prop, receiver);
    return typeof value === 'function' ? value.bind(client) : value;
  },
});
