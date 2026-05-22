import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { OrgMemberRole } from 'src/domain/org-member-role.enum';
import { OrganizationMember } from './entities/organization-member.entity';
import { OrganizerProfile } from 'src/users/entities/organizer-profile.entity';

@Injectable()
export class OrganizationAccessService {
  constructor(
    @InjectRepository(OrganizationMember)
    private readonly memberRepository: Repository<OrganizationMember>,
    @InjectRepository(OrganizerProfile)
    private readonly organizerProfileRepository: Repository<OrganizerProfile>,
  ) {}

  async isProfileOwner(
    organizerProfileId: string,
    userId: string,
  ): Promise<boolean> {
    const profile = await this.organizerProfileRepository.findOne({
      where: { id: organizerProfileId },
      select: ['id', 'userId'],
    });
    return profile?.userId === userId;
  }

  async getMembership(
    organizerProfileId: string,
    userId: string,
  ): Promise<OrgMemberRole | null> {
    const member = await this.memberRepository.findOne({
      where: { organizerProfileId, userId },
      select: ['role'],
    });
    return member?.role ?? null;
  }

  /** Owner or EDITOR co-organizer may mutate events and related resources. */
  async canEditEventsForOrganizer(
    organizerProfileId: string,
    userId: string,
  ): Promise<boolean> {
    if (await this.isProfileOwner(organizerProfileId, userId)) {
      return true;
    }
    const role = await this.getMembership(organizerProfileId, userId);
    return role === OrgMemberRole.EDITOR;
  }

  /** Organizer profile IDs where the user is an EDITOR member (not owner). */
  async getEditorOrganizerProfileIds(userId: string): Promise<string[]> {
    const rows = await this.memberRepository.find({
      where: { userId, role: OrgMemberRole.EDITOR },
      select: ['organizerProfileId'],
    });
    return rows.map((r) => r.organizerProfileId);
  }

  /** All organizer profiles the user can manage events for (owner + EDITOR memberships). */
  async getEditableOrganizerProfileIds(userId: string): Promise<string[]> {
    const owned = await this.organizerProfileRepository.find({
      where: { userId },
      select: ['id'],
    });
    const editorIds = await this.getEditorOrganizerProfileIds(userId);
    const ids = new Set<string>([
      ...owned.map((p) => p.id),
      ...editorIds,
    ]);
    return [...ids];
  }

  async getMembershipsForUser(userId: string): Promise<OrganizationMember[]> {
    return this.memberRepository.find({
      where: { userId },
      relations: ['organizerProfile'],
    });
  }

  async findMembersForProfile(
    organizerProfileId: string,
  ): Promise<OrganizationMember[]> {
    return this.memberRepository.find({
      where: { organizerProfileId },
      relations: ['user'],
      order: { createdAt: 'ASC' },
    });
  }

  async removeMemberIfOwned(
    organizerProfileId: string,
    ownerUserId: string,
    memberId: string,
  ): Promise<void> {
    if (!(await this.isProfileOwner(organizerProfileId, ownerUserId))) {
      return;
    }
    await this.memberRepository.delete({
      id: memberId,
      organizerProfileId,
    });
  }

  async profileIdsWithRole(
    userId: string,
    roles: OrgMemberRole[],
  ): Promise<string[]> {
    if (roles.length === 0) return [];
    const rows = await this.memberRepository.find({
      where: { userId, role: In(roles) },
      select: ['organizerProfileId'],
    });
    return rows.map((r) => r.organizerProfileId);
  }
}
