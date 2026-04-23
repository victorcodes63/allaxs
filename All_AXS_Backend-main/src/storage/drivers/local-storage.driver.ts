/**
 * Local file system storage driver
 */

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  IStorage,
  InitUploadParams,
  InitUploadResult,
} from '../interfaces/storage.interface';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class LocalStorage implements IStorage {
  private readonly uploadDir: string;
  private readonly staticBaseUrl: string;

  constructor(private readonly configService: ConfigService) {
    // Upload directory: uploads/events/{eventId}/banner.{ext}
    this.uploadDir = path.join(process.cwd(), 'uploads');
    // Static URL base: /static
    this.staticBaseUrl = this.configService.get<string>(
      'STATIC_BASE_URL',
      '/static',
    );
  }

  async initUpload(params: InitUploadParams): Promise<InitUploadResult> {
    const { key } = params;

    // For local storage, we return direct upload mode
    // The final path will be served from /static/{key}
    const finalPathHint = `${this.staticBaseUrl}/${key}`;

    return Promise.resolve({
      mode: 'direct',
      directUpload: true,
      finalPathHint,
    });
  }

  finalizeUrl(key: string): string {
    // Return the static URL path
    return `${this.staticBaseUrl}/${key}`;
  }

  async saveDirect(opts: {
    key: string;
    file: Express.Multer.File;
  }): Promise<string> {
    const { key, file } = opts;

    // Ensure upload directory exists
    const fullPath = path.join(this.uploadDir, key);
    const dir = path.dirname(fullPath);
    await fs.mkdir(dir, { recursive: true });

    // Write file
    await fs.writeFile(fullPath, file.buffer);

    // Return the final URL
    return this.finalizeUrl(key);
  }
}
