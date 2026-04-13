import 'server-only';

import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const PASSWORD_SALT_BYTES = 16;
const SESSION_TOKEN_BYTES = 32;
const ENCRYPTION_IV_BYTES = 12;
const ENCRYPTION_TAG_BYTES = 16;

function getAppSecret() {
  if (process.env.APP_SECRET) {
    return process.env.APP_SECRET;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('APP_SECRET is required in production.');
  }

  return 'debateos-dev-secret';
}

function getEncryptionKey() {
  return scryptSync(getAppSecret(), 'debateos-encryption', 32);
}

export function hashPassword(password: string) {
  const salt = randomBytes(PASSWORD_SALT_BYTES).toString('hex');
  const derived = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, passwordHash: string) {
  const [salt, expected] = passwordHash.split(':');
  if (!salt || !expected) return false;

  const derived = scryptSync(password, salt, 64);
  const expectedBuffer = Buffer.from(expected, 'hex');

  if (derived.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(derived, expectedBuffer);
}

export function generateSessionToken() {
  return randomBytes(SESSION_TOKEN_BYTES).toString('base64url');
}

export function hashSessionToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function encryptSecret(value: string) {
  const iv = randomBytes(ENCRYPTION_IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    iv.toString('base64url'),
    tag.toString('base64url'),
    encrypted.toString('base64url'),
  ].join('.');
}

export function decryptSecret(payload: string) {
  const [ivValue, tagValue, encryptedValue] = payload.split('.');
  if (!ivValue || !tagValue || !encryptedValue) {
    throw new Error('Invalid encrypted payload.');
  }

  const iv = Buffer.from(ivValue, 'base64url');
  const tag = Buffer.from(tagValue, 'base64url');
  const encrypted = Buffer.from(encryptedValue, 'base64url');

  if (iv.length !== ENCRYPTION_IV_BYTES || tag.length !== ENCRYPTION_TAG_BYTES) {
    throw new Error('Invalid encrypted payload metadata.');
  }

  const decipher = createDecipheriv('aes-256-gcm', getEncryptionKey(), iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}
