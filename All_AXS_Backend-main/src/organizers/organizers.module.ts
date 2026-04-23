import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganizerProfile } from '../users/entities/organizer-profile.entity';
import { User } from '../users/entities/user.entity';
import { OrganizerProfilesService } from './organizer-profiles.service';
import { OrganizerProfilesController } from './organizer-profiles.controller';

@Module({
  imports: [TypeOrmModule.forFeature([OrganizerProfile, User])],
  controllers: [OrganizerProfilesController],
  providers: [OrganizerProfilesService],
  exports: [OrganizerProfilesService],
})
export class OrganizersModule {}
