import { Module } from '@nestjs/common';
import { DarajaB2cService } from './daraja-b2c.service';

@Module({
  providers: [DarajaB2cService],
  exports: [DarajaB2cService],
})
export class PaymentsModule {}
