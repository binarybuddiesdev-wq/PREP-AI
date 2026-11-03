import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import type { UploadApiResponse } from 'cloudinary';

interface ICloudinaryPdfClient {
  config(options: Record<string, unknown>): unknown;
  uploader: {
    upload_stream(
      options: Record<string, unknown>,
      callback: (error: Error | undefined, result?: UploadApiResponse) => void
    ): NodeJS.WritableStream;
    destroy(publicId: string, options: Record<string, unknown>): Promise<{ result?: string }>;
  };
  utils: {
    private_download_url(
      publicId: string,
      format: string,
      options: Record<string, unknown>
    ): string;
  };
}

const MAX_SIGNED_URL_SECONDS = 300;
const DOWNLOAD_TIMEOUT_MS = 30_000;

@Injectable()
export class PdfStorageService {
  private configured = false;

  constructor(
    private readonly config: ConfigService,
    private readonly client: ICloudinaryPdfClient = cloudinary as unknown as ICloudinaryPdfClient
  ) {}

  async upload(buffer: Buffer, sourceId: string): Promise<string> {
    this.configure();
    if (!this.configured) throw new ServiceUnavailableException('PDF storage is not configured');

    try {
      const result = await new Promise<UploadApiResponse>((resolve, reject) => {
        const stream = this.client.uploader.upload_stream(
          {
            resource_type: 'raw',
            type: 'authenticated',
            folder: 'prepai/private-pdfs',
            public_id: sourceId,
            overwrite: false,
            unique_filename: false,
            use_filename: false,
          },
          (error, uploaded) => {
            if (error || !uploaded?.public_id) {
              reject(new Error('PDF storage upload failed', { cause: error }));
              return;
            }
            resolve(uploaded);
          }
        );
        stream.on('error', reject);
        stream.end(buffer);
      });
      return result.public_id;
    } catch {
      throw new ServiceUnavailableException('PDF storage upload failed');
    }
  }

  async download(publicId: string, maxBytes: number): Promise<Buffer> {
    this.configure();
    if (!this.configured) throw new ServiceUnavailableException('PDF storage is not configured');

    try {
      const signedUrl = this.client.utils.private_download_url(publicId, 'pdf', {
        resource_type: 'raw',
        type: 'authenticated',
        expires_at: Math.floor(Date.now() / 1000) + MAX_SIGNED_URL_SECONDS,
        attachment: false,
      });
      const response = await fetch(signedUrl, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
      if (!response.ok) throw new Error('PDF download failed');
      const contentLength = Number(response.headers.get('content-length'));
      if (Number.isFinite(contentLength) && contentLength > maxBytes) {
        throw new Error('Stored PDF exceeds the download size limit');
      }
      if (!response.body) throw new Error('PDF download returned no body');
      const reader = response.body.getReader();
      const chunks: Buffer[] = [];
      let byteLength = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          byteLength += value.byteLength;
          if (byteLength > maxBytes) {
            await reader.cancel();
            throw new Error('Stored PDF exceeds the download size limit');
          }
          chunks.push(Buffer.from(value));
        }
      } finally {
        reader.releaseLock();
      }
      return Buffer.concat(chunks, byteLength);
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === 'Stored PDF exceeds the download size limit'
      ) {
        throw error;
      }
      throw new ServiceUnavailableException('PDF storage download failed');
    }
  }

  async delete(publicId: string): Promise<void> {
    this.configure();
    if (!this.configured) throw new ServiceUnavailableException('PDF storage is not configured');
    try {
      const result = await this.client.uploader.destroy(publicId, {
        resource_type: 'raw',
        type: 'authenticated',
        invalidate: true,
      });
      if (result.result !== 'ok' && result.result !== 'not found') {
        throw new Error('PDF storage deletion failed');
      }
    } catch {
      throw new ServiceUnavailableException('PDF storage deletion failed');
    }
  }

  private configure(): void {
    if (this.configured) return;
    const cloudName = this.config.get<string>('CLOUDINARY_CLOUD_NAME');
    const apiKey = this.config.get<string>('CLOUDINARY_API_KEY');
    const apiSecret = this.config.get<string>('CLOUDINARY_API_SECRET');
    if (!cloudName || !apiKey || !apiSecret) return;
    this.client.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true,
    });
    this.configured = true;
  }
}
