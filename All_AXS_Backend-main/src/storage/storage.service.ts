/**
 * Storage service that provides the appropriate storage driver
 */

import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IStorage } from './interfaces/storage.interface';
import { SpacesStorage } from './drivers/spaces-storage.driver';
import { LocalStorage } from './drivers/local-storage.driver';
import { StubStorage } from './drivers/stub-storage.driver';
import { Logger } from '@nestjs/common';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly driver: IStorage;

  constructor(private readonly configService: ConfigService) {
    const driverType = this.configService.get<string>('STORAGE_DRIVER', 'stub');

    switch (driverType) {
      case 'spaces':
        this.driver = new SpacesStorage(configService);
        break;
      case 'local':
        this.driver = new LocalStorage(configService);
        break;
      case 'stub':
      default:
        this.driver = new StubStorage();
        break;
    }
  }

  onModuleInit() {
    const driverType = this.configService.get<string>('STORAGE_DRIVER', 'stub');
    this.logger.log(`Storage driver: ${driverType}`);
  }

  /**
   * Get the storage driver instance
   */
  getDriver(): IStorage {
    return this.driver;
  }
}
