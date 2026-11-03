import { BadRequestException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { IDEMPOTENCY_KEY_REQUIRED } from '@/common/constants/api.constants.js';

const MAX_IDEMPOTENCY_KEY_LENGTH = 128;
const VISIBLE_ASCII_KEY = /^[\x21-\x7e]+$/;

export function requireIdempotencyKey(value: unknown): string {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > MAX_IDEMPOTENCY_KEY_LENGTH ||
    !VISIBLE_ASCII_KEY.test(value)
  ) {
    throw new BadRequestException(IDEMPOTENCY_KEY_REQUIRED);
  }

  return value;
}

export function createIdempotencyRequestFingerprint(scope: string, payload: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify([scope, canonicalize(payload)]))
    .digest('hex');
}

export function createIdempotencyOperationId(actorId: string, scope: string, key: string): string {
  const validatedKey = requireIdempotencyKey(key);
  const idBytes = createHash('sha256')
    .update(JSON.stringify([actorId, scope, validatedKey]))
    .digest()
    .subarray(0, 16);
  idBytes[6] = (idBytes[6] & 0x0f) | 0x80;
  idBytes[8] = (idBytes[8] & 0x3f) | 0x80;

  const idHex = idBytes.toString('hex');
  return [
    idHex.slice(0, 8),
    idHex.slice(8, 12),
    idHex.slice(12, 16),
    idHex.slice(16, 20),
    idHex.slice(20),
  ].join('-');
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;

  const fields = Object.entries(value as Record<string, unknown>)
    .filter(([, fieldValue]) => fieldValue !== undefined)
    .sort(([left], [right]) => left.localeCompare(right));

  return `{${fields
    .map(([field, fieldValue]) => `${JSON.stringify(field)}:${canonicalize(fieldValue)}`)
    .join(',')}}`;
}
