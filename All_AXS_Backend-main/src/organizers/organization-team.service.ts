import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { OrganizationMember } from './entities/organization-member.entity';
import { OrganizationInvite } from './entities/organization-invite.entity';
import { OrganizerProfile } from 'src/users/entities/organizer-profile.entity';
import { User } from 'src/users/entities/user.entity';
import { OrgMemberRole } from 'src/domain/org-member-role.enum';
import { CreateOrganizationInviteDto } from './dto/create-organization-invite.dto';
import { OrganizationAccessService } from './organization-access.service';
import { UsersService } from 'src/users/users.service';
import { EmailService } from 'src/auth/services/email.service';

@Injectable()
export class OrganizationTeamService {
  constructor(
    @InjectRepository(OrganizationMember)
    private readonly memberRepository: Repository<OrganizationMember>,
    @InjectRepository(OrganizationInvite)
    private readonly inviteRepository: Repository<OrganizationInvite>,
    @InjectRepository(OrganizerProfile)
    private readonly organizerProfileRepository: Repository<OrganizerProfile>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly accessService: OrganizationAccessService,
    private readonly usersService: UsersService,
    private readonly emailService: EmailService,
  ) {}

  private generateToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private async requireOwnerProfile(userId: string): Promise<OrganizerProfile> {
    const profile = await this.organizerProfileRepository.findOne({
      where: { userId },
      relations: ['user'],
    });
    if (!profile) {
      throw new ForbiddenException(
        'Organizer profile not found. Complete onboarding first.',
      );
    }
    return profile;
  }

  async getTeamOverview(ownerUserId: string) {
    const profile = await this.requireOwnerProfile(ownerUserId);
    const members = await this.accessService.findMembersForProfile(profile.id);
    const pendingInvites = await this.inviteRepository.find({
      where: { organizerProfileId: profile.id, acceptedAt: null as unknown as undefined },
      order: { createdAt: 'DESC' },
    });

    return {
      orgName: profile.orgName,
      organizerProfileId: profile.id,
      owner: {
        userId: profile.userId,
        email: profile.user?.email ?? null,
        name: profile.user?.name ?? null,
      },
      members: members.map((m) => ({
        id: m.id,
        userId: m.userId,
        email: m.user?.email ?? null,
        name: m.user?.name ?? null,
        role: m.role,
        joinedAt: m.createdAt,
      })),
      pendingInvites: pendingInvites
        .filter((i) => !i.acceptedAt && i.expiresAt > new Date())
        .map((i) => ({
          id: i.id,
          email: i.email,
          role: i.role,
          expiresAt: i.expiresAt,
          createdAt: i.createdAt,
        })),
    };
  }

  async createInvite(ownerUserId: string, dto: CreateOrganizationInviteDto) {
    const profile = await this.requireOwnerProfile(ownerUserId);
    const email = this.normalizeEmail(dto.email);

    if (profile.user?.email && this.normalizeEmail(profile.user.email) === email) {
      throw new BadRequestException('You cannot invite yourself.');
    }

    const existingUser = await this.userRepository.findOne({ where: { email } });
    if (existingUser) {
      const alreadyMember = await this.memberRepository.findOne({
        where: { organizerProfileId: profile.id, userId: existingUser.id },
      });
      if (alreadyMember) {
        throw new ConflictException('This user is already on your team.');
      }
    }

    const pending = await this.inviteRepository.find({
      where: { organizerProfileId: profile.id, email, acceptedAt: null as unknown as undefined },
    });
    const openInvite = pending.find((i) => !i.acceptedAt && i.expiresAt > new Date());
    if (openInvite) {
      throw new ConflictException('An active invite already exists for this email.');
    }

    await this.inviteRepository.update(
      { organizerProfileId: profile.id, email, acceptedAt: null as unknown as undefined },
      { acceptedAt: new Date() },
    );

    const token = this.generateToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const invite = await this.inviteRepository.save(
      this.inviteRepository.create({
        organizerProfileId: profile.id,
        email,
        role: dto.role,
        token,
        invitedByUserId: ownerUserId,
        expiresAt,
      }),
    );

    await this.emailService.sendOrganizationInviteEmail({
      to: email,
      orgName: profile.orgName,
      role: dto.role,
      token,
      inviterName: profile.user?.name ?? null,
    });

    return {
      id: invite.id,
      email: invite.email,
      role: invite.role,
      expiresAt: invite.expiresAt,
    };
  }

  async revokeInvite(ownerUserId: string, inviteId: string): Promise<void> {
    const profile = await this.requireOwnerProfile(ownerUserId);
    const invite = await this.inviteRepository.findOne({
      where: { id: inviteId, organizerProfileId: profile.id },
    });
    if (!invite || invite.acceptedAt) {
      throw new NotFoundException('Invite not found');
    }
    invite.acceptedAt = new Date();
    await this.inviteRepository.save(invite);
  }

  async removeMember(ownerUserId: string, memberId: string): Promise<void> {
    const profile = await this.requireOwnerProfile(ownerUserId);
    const result = await this.memberRepository.delete({
      id: memberId,
      organizerProfileId: profile.id,
    });
    if (!result.affected) {
      throw new NotFoundException('Team member not found');
    }
  }

  async previewInvite(token: string) {
    const invite = await this.inviteRepository.findOne({
      where: { token },
      relations: ['organizerProfile'],
    });
    if (!invite || invite.acceptedAt) {
      throw new NotFoundException('Invite not found or already used');
    }
    if (invite.expiresAt <= new Date()) {
      throw new BadRequestException('This invite has expired');
    }
    return {
      orgName: invite.organizerProfile?.orgName ?? 'Organization',
      role: invite.role,
      email: invite.email,
      expiresAt: invite.expiresAt,
    };
  }

  async acceptInvite(userId: string, token: string) {
    const user = await this.usersService.findByIdOrFail(userId);
    const invite = await this.inviteRepository.findOne({
      where: { token },
      relations: ['organizerProfile'],
    });

    if (!invite || invite.acceptedAt) {
      throw new NotFoundException('Invite not found or already used');
    }
    if (invite.expiresAt <= new Date()) {
      throw new BadRequestException('This invite has expired');
    }

    if (this.normalizeEmail(user.email) !== this.normalizeEmail(invite.email)) {
      throw new ForbiddenException(
        'Sign in with the email address that received this invite.',
      );
    }

    const profile = invite.organizerProfile;
    if (!profile) {
      throw new NotFoundException('Organization not found');
    }

    if (profile.userId === userId) {
      throw new BadRequestException('You already own this organization.');
    }

    const existing = await this.memberRepository.findOne({
      where: { organizerProfileId: profile.id, userId },
    });
    if (existing) {
      throw new ConflictException('You are already a member of this team.');
    }

    await this.usersService.addOrganizerRole(userId);

    const member = await this.memberRepository.save(
      this.memberRepository.create({
        organizerProfileId: profile.id,
        userId,
        role: invite.role,
      }),
    );

    invite.acceptedAt = new Date();
    invite.acceptedByUserId = userId;
    await this.inviteRepository.save(invite);

    return {
      memberId: member.id,
      organizerProfileId: profile.id,
      orgName: profile.orgName,
      role: member.role,
    };
  }
}
