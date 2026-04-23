/**
 * Stub storage driver that disables uploads
 */

import { Injectable, NotImplementedException } from '@nestjs/common';
import {
  IStorage,
  InitUploadParams,
  InitUploadResult,
} from '../interfaces/storage.interface';

@Injectable()
export class StubStorage implements IStorage {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  initUpload(_params: InitUploadParams): Promise<InitUploadResult> {
    return Promise.reject(
      new NotImplementedException(
        'File uploads are disabled. Set STORAGE_DRIVER to "spaces" or "local" to enable uploads.',
      ),
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  finalizeUrl(_key: string): string {
    return '';
  }
}
