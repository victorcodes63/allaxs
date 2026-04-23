// src/database/data-source.ts
/**
 * DataSource export for TypeORM CLI
 * This file re-exports the factory-created DataSource to maintain compatibility
 * with existing TypeORM CLI commands and migrations
 */

import { AppDataSource } from './data-source.factory';

export default AppDataSource;
