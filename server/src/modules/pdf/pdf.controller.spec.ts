import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { PdfController } from './pdf.controller.js';

describe('PdfController', () => {
  const makeFile = (fieldname = 'file') => ({
    fieldname,
    filename: 'study.pdf',
    mimetype: 'application/pdf',
    toBuffer: vi.fn().mockResolvedValue(Buffer.from('%PDF-1.7')),
  });

  it('accepts the required file field and returns an accepted response', async () => {
    const pdfs = { upload: vi.fn().mockResolvedValue({ id: 'pdf_1', status: 'queued' }) };
    const controller = new PdfController(pdfs as never);
    const file = makeFile();
    const result = await controller.upload(
      { file: vi.fn().mockResolvedValue(file) } as never,
      'user_1',
      'request-1'
    );
    expect(file.toBuffer).toHaveBeenCalledOnce();
    expect(pdfs.upload).toHaveBeenCalledWith(
      expect.any(Buffer),
      'study.pdf',
      'application/pdf',
      'user_1',
      'request-1'
    );
    expect(result).toEqual({
      message: 'PDF upload accepted',
      data: { id: 'pdf_1', status: 'queued' },
    });
  });

  it('rejects missing files and unexpected multipart field names', async () => {
    const controller = new PdfController({ upload: vi.fn() } as never);
    await expect(
      controller.upload({ file: vi.fn().mockResolvedValue(undefined) } as never, 'u', 'request-1')
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      controller.upload(
        { file: vi.fn().mockResolvedValue(makeFile('attachment')) } as never,
        'u',
        'request-1'
      )
    ).rejects.toThrow('multipart field named "file"');
  });

  it('requires an idempotency key before reading the multipart file', async () => {
    const controller = new PdfController({ upload: vi.fn() } as never);
    const request = { file: vi.fn() };

    await expect(controller.upload(request as never, 'u', undefined)).rejects.toThrow(
      'Idempotency-Key'
    );
    expect(request.file).not.toHaveBeenCalled();
  });

  it('maps Fastify file size errors and propagates unrelated failures', async () => {
    const controller = new PdfController({
      upload: vi.fn().mockRejectedValue(new Error('service error')),
    } as never);
    const oversized = Object.assign(new Error('too big'), { code: 'FST_REQ_FILE_TOO_LARGE' });
    await expect(
      controller.upload({ file: vi.fn().mockRejectedValue(oversized) } as never, 'u', 'request-1')
    ).rejects.toThrow('PDF exceeds the configured file size limit');
    await expect(
      controller.upload({ file: vi.fn().mockResolvedValue(makeFile()) } as never, 'u', 'request-1')
    ).rejects.toThrow('service error');
    const badRequest = new BadRequestException('invalid');
    const badRequestController = new PdfController({
      upload: vi.fn().mockRejectedValue(badRequest),
    } as never);
    await expect(
      badRequestController.upload(
        { file: vi.fn().mockResolvedValue(makeFile()) } as never,
        'u',
        'request-1'
      )
    ).rejects.toBe(badRequest);
  });

  it('delegates list, get, reindex, and delete to the owned source service', async () => {
    const pdfs = {
      list: vi.fn().mockResolvedValue([]),
      get: vi.fn().mockResolvedValue({ id: 'pdf_1' }),
      reindex: vi.fn().mockResolvedValue({ id: 'pdf_1', status: 'queued' }),
      delete: vi.fn().mockResolvedValue({ id: 'pdf_1', status: 'deleting' }),
    };
    const controller = new PdfController(pdfs as never);
    expect(await controller.list('u', { limit: 10 })).toMatchObject({ data: [] });
    expect(await controller.get('pdf_1', 'u')).toMatchObject({ data: { id: 'pdf_1' } });
    expect(await controller.reindex('pdf_1', 'u', 'request-1')).toMatchObject({
      data: { status: 'queued' },
    });
    expect(pdfs.reindex).toHaveBeenCalledWith('pdf_1', 'u', 'request-1');
    expect(await controller.delete('pdf_1', 'u')).toMatchObject({ data: { status: 'deleting' } });
  });
});
