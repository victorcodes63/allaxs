/**
 * Vercel Blob storage driver for production-safe event media.
 */

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { put } from '@vercel/blob';
import {
  IStorage,
  InitUploadParams,
  InitUploadResult,
} from '../interfaces/storage.interface';

@Injectable()
export class VercelBlobStorage implements IStorage {
  private readonly token?: string;

  constructor(private readonly configService: ConfigService) {
    this.token = this.configService.get<string>('BLOB_READ_WRITE_TOKEN');
  }

  async initUpload(params: InitUploadParams): Promise<InitUploadResult> {
    return Promise.resolve({
      mode: 'direct',
      directUpload: true,
      finalPathHint: params.key,
    });
  }

  finalizeUrl(key: string): string {
    return key;
  }

  async saveDirect(opts: {
    key: string;
    file: Express.Multer.File;
  }): Promise<string> {
    const blob = await put(opts.key, opts.file.buffer, {
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: opts.file.mimetype,
      token: this.token,
    });

    return blob.url;
  }
}
