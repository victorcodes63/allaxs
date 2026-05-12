/**
 * Storage service that provides the appropriate storage driver
 */

import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IStorage } from './interfaces/storage.interface';
import { SpacesStorage } from './drivers/spaces-storage.driver';
import { LocalStorage } from './drivers/local-storage.driver';
import { StubStorage } from './drivers/stub-storage.driver';
import { VercelBlobStorage } from './drivers/vercel-blob-storage.driver';
import { Logger } from '@nestjs/common';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly driver: IStorage;
  private readonly driverType: string;

  constructor(private readonly configService: ConfigService) {
    this.driverType = this.resolveDriverType();

    switch (this.driverType) {
      case 'spaces':
        this.driver = new SpacesStorage(configService);
        break;
      case 'local':
        this.driver = new LocalStorage(configService);
        break;
      case 'blob':
      case 'vercel-blob':
        this.driver = new VercelBlobStorage(configService);
        break;
      case 'stub':
      default:
        this.driver = new StubStorage();
        break;
    }
  }

  /**
   * Pick a sensible default when `STORAGE_DRIVER` isn't set:
   * - `local` for local dev (so banner uploads persist on disk under `/static`)
   * - `stub` everywhere else (Vercel, production, tests) so we never silently
   *   write to a disk that won't survive a deploy.
   */
  private resolveDriverType(): string {
    const explicit = this.configService.get<string>('STORAGE_DRIVER');
    if (explicit) return explicit;

    const nodeEnv = this.configService.get<string>('NODE_ENV', 'development');
    const isVercel = !!process.env.VERCEL;
    if (!isVercel && nodeEnv !== 'production' && nodeEnv !== 'test') {
      return 'local';
    }
    return 'stub';
  }

  onModuleInit() {
    this.logger.log(`Storage driver: ${this.driverType}`);
  }

  /**
   * Get the storage driver instance
   */
  getDriver(): IStorage {
    return this.driver;
  }
}
