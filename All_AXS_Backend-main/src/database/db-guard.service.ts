/**
 * Database guard service
 * Runs on module initialization to verify database name matches environment
 * and logs database fingerprint
 */

import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { assertDbMatchesEnv } from './data-source.factory';

@Injectable()
export class DbGuardService implements OnModuleInit {
  private readonly logger = new Logger(DbGuardService.name);

  constructor(@InjectDataSource() private dataSource: DataSource) {}

  async onModuleInit(): Promise<void> {
    try {
      // Wait for DataSource to be initialized (should already be initialized by TypeORM module)
      if (!this.dataSource.isInitialized) {
        await this.dataSource.initialize();
      }

      // Assert database name matches environment expectations
      await assertDbMatchesEnv(this.dataSource);

      // Get current database name and user
      const result = (await this.dataSource.query(
        'SELECT current_database() as db, current_user as role',
      )) as unknown;
      const typedResult = result as Array<{ db: string; role: string }>;
      const firstResult = typedResult[0];
      const dbName = firstResult?.db;
      const dbUser = firstResult?.role;
      const env = process.env.NODE_ENV || 'development';

      if (dbName && dbUser) {
        // Log fingerprint in the format: [DB] connected db=<name> user=<role> env=<NODE_ENV>
        this.logger.log(
          `[DB] connected db=${dbName} user=${dbUser} env=${env}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Database guard check failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }
}
