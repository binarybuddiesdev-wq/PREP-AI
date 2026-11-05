import { Writable } from 'node:stream';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';
import { PdfStorageService } from './pdf-storage.service.js';

describe('PdfStorageService', () => {
  it('can be resolved by Nest when no custom Cloudinary client is provided', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        PdfStorageService,
        { provide: ConfigService, useValue: { get: () => undefined } },
      ],
    }).compile();

    expect(moduleRef.get(PdfStorageService)).toBeInstanceOf(PdfStorageService);
    await moduleRef.close();
  });

  it('uploads an authenticated raw asset and returns only its stable asset ID', async () => {
    const uploadStream = vi.fn((_options, callback) => {
      const stream = new Writable({
        write(_chunk, _encoding, done) {
          done();
        },
      });
      queueMicrotask(() => callback(null, { public_id: 'prepai/private-pdfs/source_1' }));
      return stream;
    });
    const client = {
      config: vi.fn(),
      uploader: { upload_stream: uploadStream, destroy: vi.fn() },
      utils: { private_download_url: vi.fn() },
    };
    const storage = new PdfStorageService(
      {
        get: (key: string) =>
          ({
            CLOUDINARY_CLOUD_NAME: 'cloud',
            CLOUDINARY_API_KEY: 'key',
            CLOUDINARY_API_SECRET: 'secret',
          })[key],
      } as never,
      client as never
    );

    await expect(storage.upload(Buffer.from('%PDF-1.7'), 'source_1')).resolves.toBe(
      'prepai/private-pdfs/source_1'
    );
    expect(uploadStream).toHaveBeenCalledWith(
      expect.objectContaining({ resource_type: 'raw', type: 'authenticated' }),
      expect.any(Function)
    );
  });

  it('downloads only through a short-lived signed URL and rejects oversized content', async () => {
    const privateDownloadUrl = vi.fn().mockReturnValue('https://signed.example/file');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => null },
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array(9));
          controller.close();
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const storage = new PdfStorageService(
      {
        get: (key: string) =>
          ({
            CLOUDINARY_CLOUD_NAME: 'cloud',
            CLOUDINARY_API_KEY: 'key',
            CLOUDINARY_API_SECRET: 'secret',
          })[key],
      } as never,
      {
        config: vi.fn(),
        uploader: { upload_stream: vi.fn(), destroy: vi.fn() },
        utils: { private_download_url: privateDownloadUrl },
      } as never
    );

    await expect(storage.download('persisted-asset-id', 8)).rejects.toThrow(
      'Stored PDF exceeds the download size limit'
    );
    expect(privateDownloadUrl).toHaveBeenCalledWith(
      'persisted-asset-id',
      'pdf',
      expect.objectContaining({
        resource_type: 'raw',
        type: 'authenticated',
        expires_at: expect.any(Number),
      })
    );
    expect(fetchMock).toHaveBeenCalledWith(
      'https://signed.example/file',
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });

  it('reads a successful download in bounded chunks', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => '4' },
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(Uint8Array.from([37, 80]));
            controller.enqueue(Uint8Array.from([68, 70]));
            controller.close();
          },
        }),
      })
    );
    const storage = new PdfStorageService(
      {
        get: (key: string) =>
          ({
            CLOUDINARY_CLOUD_NAME: 'cloud',
            CLOUDINARY_API_KEY: 'key',
            CLOUDINARY_API_SECRET: 'secret',
          })[key],
      } as never,
      {
        config: vi.fn(),
        uploader: { upload_stream: vi.fn(), destroy: vi.fn() },
        utils: { private_download_url: vi.fn().mockReturnValue('https://signed.example/file') },
      } as never
    );
    await expect(storage.download('asset', 8)).resolves.toEqual(Buffer.from('%PDF'));
  });

  it('does not return transient URLs and reports missing configuration safely', async () => {
    const storage = new PdfStorageService(
      { get: () => undefined } as never,
      {
        config: vi.fn(),
        uploader: { upload_stream: vi.fn(), destroy: vi.fn() },
        utils: { private_download_url: vi.fn() },
      } as never
    );
    await expect(storage.upload(Buffer.from('%PDF'), 'source_1')).rejects.toThrow(
      'PDF storage is not configured'
    );
  });

  it('reports failed, malformed, missing-body, and unavailable downloads safely', async () => {
    const client = {
      config: vi.fn(),
      uploader: { upload_stream: vi.fn(), destroy: vi.fn() },
      utils: { private_download_url: vi.fn().mockReturnValue('https://signed.example/file') },
    };
    const storage = new PdfStorageService(
      {
        get: (key: string) =>
          ({
            CLOUDINARY_CLOUD_NAME: 'cloud',
            CLOUDINARY_API_KEY: 'key',
            CLOUDINARY_API_SECRET: 'secret',
          })[key],
      } as never,
      client as never
    );
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: false })
        .mockResolvedValueOnce({ ok: true, headers: { get: () => null }, body: null })
        .mockRejectedValueOnce(new Error('network offline'))
    );
    await expect(storage.download('asset', 10)).rejects.toThrow('PDF storage download failed');
    await expect(storage.download('asset', 10)).rejects.toThrow('PDF storage download failed');
    await expect(storage.download('asset', 10)).rejects.toThrow('PDF storage download failed');
  });

  it('treats missing private assets as deleted and rejects Cloudinary delete failures', async () => {
    const client = {
      config: vi.fn(),
      uploader: {
        upload_stream: vi.fn(),
        destroy: vi
          .fn()
          .mockResolvedValueOnce({ result: 'not found' })
          .mockResolvedValueOnce({ result: 'error' }),
      },
      utils: { private_download_url: vi.fn() },
    };
    const storage = new PdfStorageService(
      {
        get: (key: string) =>
          ({
            CLOUDINARY_CLOUD_NAME: 'cloud',
            CLOUDINARY_API_KEY: 'key',
            CLOUDINARY_API_SECRET: 'secret',
          })[key],
      } as never,
      client as never
    );
    await expect(storage.delete('gone')).resolves.toBeUndefined();
    await expect(storage.delete('asset')).rejects.toThrow('PDF storage deletion failed');
  });

  it('accepts successful provider deletion and exercises the default Cloudinary client safely', async () => {
    const client = {
      config: vi.fn(),
      uploader: {
        upload_stream: vi.fn(),
        destroy: vi.fn().mockResolvedValue({ result: 'ok' }),
      },
      utils: { private_download_url: vi.fn() },
    };
    const storage = new PdfStorageService(
      {
        get: (key: string) =>
          ({
            CLOUDINARY_CLOUD_NAME: 'cloud',
            CLOUDINARY_API_KEY: 'key',
            CLOUDINARY_API_SECRET: 'secret',
          })[key],
      } as never,
      client as never
    );
    await expect(storage.delete('asset')).resolves.toBeUndefined();
    const unconfigured = new PdfStorageService({ get: () => undefined } as never);
    await expect(unconfigured.upload(Buffer.from('%PDF'), 'source')).rejects.toThrow(
      'PDF storage is not configured'
    );
    await expect(unconfigured.download('asset', 100)).rejects.toThrow(
      'PDF storage is not configured'
    );
    await expect(unconfigured.delete('asset')).rejects.toThrow('PDF storage is not configured');
  });

  it('handles upload callback errors and provider responses without an asset identifier', async () => {
    for (const callbackResult of [
      [new Error('provider error'), undefined],
      [undefined, {}],
    ] as const) {
      const uploadStream = vi.fn((_options, callback) => {
        const stream = new Writable({
          write(_chunk, _encoding, done) {
            done();
          },
        });
        queueMicrotask(() => callback(callbackResult[0], callbackResult[1]));
        return stream;
      });
      const storage = new PdfStorageService(
        {
          get: (key: string) =>
            ({
              CLOUDINARY_CLOUD_NAME: 'cloud',
              CLOUDINARY_API_KEY: 'key',
              CLOUDINARY_API_SECRET: 'secret',
            })[key],
        } as never,
        {
          config: vi.fn(),
          uploader: { upload_stream: uploadStream, destroy: vi.fn() },
          utils: { private_download_url: vi.fn() },
        } as never
      );
      await expect(storage.upload(Buffer.from('%PDF'), 'source')).rejects.toThrow(
        'PDF storage upload failed'
      );
    }
  });

  it('rejects declared downloads larger than the configured bound before reading the body', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => '20' },
        body: new ReadableStream(),
      })
    );
    const storage = new PdfStorageService(
      {
        get: (key: string) =>
          ({
            CLOUDINARY_CLOUD_NAME: 'cloud',
            CLOUDINARY_API_KEY: 'key',
            CLOUDINARY_API_SECRET: 'secret',
          })[key],
      } as never,
      {
        config: vi.fn(),
        uploader: { upload_stream: vi.fn(), destroy: vi.fn() },
        utils: { private_download_url: vi.fn().mockReturnValue('https://signed.example/file') },
      } as never
    );
    await expect(storage.download('asset', 8)).rejects.toThrow(
      'Stored PDF exceeds the download size limit'
    );
  });
});
