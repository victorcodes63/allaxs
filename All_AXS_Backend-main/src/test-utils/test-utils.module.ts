import { Module } from '@nestjs/common';
import { TestUtilsController } from './test-utils.controller';
import { DomainModule } from 'src/domain/domain.module';

@Module({
  imports: [DomainModule],
  controllers: [TestUtilsController],
})
export class TestUtilsModule {}
