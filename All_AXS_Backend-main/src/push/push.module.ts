import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WebPushSubscription } from './entities/web-push-subscription.entity';
import { WebPushService } from './web-push.service';
import { PushController } from './push.controller';
import { User } from 'src/users/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([WebPushSubscription, User])],
  controllers: [PushController],
  providers: [WebPushService],
  exports: [WebPushService],
})
export class PushModule {}
