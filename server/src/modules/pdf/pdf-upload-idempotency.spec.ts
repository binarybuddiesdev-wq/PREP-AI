import { describe, expect, it } from 'vitest';
import { createPdfUploadSourceId } from './pdf-upload-idempotency.js';

describe('createPdfUploadSourceId', () => {
  it('creates a stable Mongo ObjectId scoped to the actor and upload key', () => {
    const id = createPdfUploadSourceId('user_1', 'request-1');

    expect(id).toMatch(/^[a-f0-9]{24}$/);
    expect(createPdfUploadSourceId('user_1', 'request-1')).toBe(id);
    expect(createPdfUploadSourceId('user_2', 'request-1')).not.toBe(id);
    expect(createPdfUploadSourceId('user_1', 'request-2')).not.toBe(id);
  });
});
