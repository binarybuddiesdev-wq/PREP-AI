import { describe, expect, it } from 'vitest';
import { validatePdfUpload } from './pdf-upload.validation.js';

describe('validatePdfUpload', () => {
  it('accepts a bounded PDF signature and returns a sanitized display name', () => {
    expect(
      validatePdfUpload(
        Buffer.from('%PDF-1.7\nbody'),
        'C:\\fakepath\\Course.pdf',
        'application/pdf',
        20
      )
    ).toEqual({ displayName: 'Course.pdf', byteSize: 13 });
  });

  it.each([
    [
      Buffer.from('not a pdf'),
      'file.pdf',
      'application/pdf',
      1024,
      'Upload must contain a valid PDF file',
    ],
    [Buffer.from('%PDF-1.7'), 'file.txt', 'application/pdf', 1024, 'Only PDF files are supported'],
    [Buffer.from('%PDF-1.7'), 'file.pdf', 'text/plain', 1024, 'Only PDF files are supported'],
    [Buffer.from('%PDF-1.7'), 'file.pdf', 'application/pdf', 4, 'PDF exceeds the 4 byte limit'],
    [Buffer.alloc(0), 'file.pdf', 'application/pdf', 1024, 'PDF file is empty'],
  ])('rejects invalid upload inputs', (buffer, filename, mimetype, maxBytes, message) => {
    expect(() => validatePdfUpload(buffer, filename, mimetype, maxBytes)).toThrow(message);
  });
});
