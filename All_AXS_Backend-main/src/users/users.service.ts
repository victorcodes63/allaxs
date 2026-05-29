import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { User } from './entities/user.entity';
import { OrganizerProfile } from './entities/organizer-profile.entity';
import { Role, UserStatus } from 'src/domain/enums';
import { isClosedAccount } from './account-status.util';
import {
  DEFAULT_USER_NOTIFICATION_PREFS,
  mergeNotificationPrefs,
  normalizeNotificationPrefs,
  type UserNotificationPrefs,
} from './user-notification-prefs.types';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(OrganizerProfile)
    private readonly organizerProfileRepository: Repository<OrganizerProfile>,
  ) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { email } });
  }

  async findById(id: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { id } });
  }

  /**
   * Resolve the buyer for public guest checkout. Creates an attendee
   * account with `autoCreatedAt` when the email is new; otherwise
   * updates missing profile fields on the existing row.
   */
  async findOrCreateForGuestCheckout(data: {
    email: string;
    name: string;
    phone?: string;
    passwordHash: string;
  }): Promise<{ user: User; created: boolean }> {
    const email = data.email.trim().toLowerCase();
    const name = data.name.trim();
    const phone = data.phone?.trim() || undefined;

    const existing = await this.findByEmail(email);
    if (existing) {
      if (isClosedAccount(existing)) {
        throw new UnauthorizedException({
          message: 'This account has been closed.',
          code: 'accountClosed',
        });
      }
      if (existing.status !== UserStatus.ACTIVE) {
        throw new UnauthorizedException({
          message: 'Account suspended. Please contact support.',
          code: 'accountSuspended',
        });
      }
      let dirty = false;
      if (name && (!existing.name || !existing.name.trim())) {
        existing.name = name;
        dirty = true;
      }
      if (phone && !existing.phone) {
        existing.phone = phone;
        dirty = true;
      }
      if (dirty) {
        await this.userRepository.save(existing);
      }
      return { user: existing, created: false };
    }

    const user = this.userRepository.create({
      email,
      name: name || email.split('@')[0] || 'Guest',
      phone,
      passwordHash: data.passwordHash,
      roles: [Role.ATTENDEE],
      status: UserStatus.ACTIVE,
      autoCreatedAt: new Date(),
    });
    const saved = await this.userRepository.save(user);
    return { user: saved, created: true };
  }

  async createUser(data: {
    email: string;
    name: string;
    passwordHash: string;
    roles?: Role[];
  }): Promise<User> {
    // Check if user already exists
    const existingUser = await this.findByEmail(data.email);
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const user = this.userRepository.create({
      email: data.email,
      name: data.name,
      passwordHash: data.passwordHash,
      roles: data.roles || [Role.ATTENDEE],
    });

    return this.userRepository.save(user);
  }

  async findByIdOrFail(id: string): Promise<User> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  /** True when the user has completed organizer onboarding (org profile row exists). */
  async hasOrganizerProfile(userId: string): Promise<boolean> {
    const count = await this.organizerProfileRepository.count({
      where: { userId },
    });
    return count > 0;
  }

  /**
   * Resolve the attendee account that should own an order after admin
   * corrects a checkout email typo. Creates an active attendee when the
   * corrected address is new.
   */
  async ensureActiveAttendeeBuyer(
    email: string,
    options?: { name?: string },
  ): Promise<User> {
    const normalized = email.trim().toLowerCase();
    if (!normalized) {
      throw new BadRequestException('Email is required');
    }

    const existing = await this.findByEmail(normalized);
    if (existing) {
      if (isClosedAccount(existing)) {
        throw new UnauthorizedException({
          message: 'Target account is closed.',
          code: 'accountClosed',
        });
      }
      if (existing.status !== UserStatus.ACTIVE) {
        throw new UnauthorizedException({
          message: 'Target account is suspended.',
          code: 'accountSuspended',
        });
      }
      const roleSet = new Set(existing.roles ?? []);
      roleSet.add(Role.ATTENDEE);
      const nextRoles = [...roleSet];
      const rolesChanged =
        nextRoles.length !== (existing.roles ?? []).length ||
        !(existing.roles ?? []).includes(Role.ATTENDEE);
      if (rolesChanged) {
        existing.roles = nextRoles;
      }
      const name = options?.name?.trim();
      if (name && (!existing.name || !existing.name.trim())) {
        existing.name = name;
        await this.userRepository.save(existing);
      } else if (rolesChanged) {
        await this.userRepository.save(existing);
      }
      return existing;
    }

    const name =
      options?.name?.trim() ||
      normalized.split('@')[0] ||
      'Guest';
    const passwordHash = await bcrypt.hash(
      crypto.randomBytes(32).toString('hex'),
      10,
    );
    const user = this.userRepository.create({
      email: normalized,
      name,
      passwordHash,
      roles: [Role.ATTENDEE],
      status: UserStatus.ACTIVE,
    });
    return this.userRepository.save(user);
  }

  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    await this.userRepository.update({ id: userId }, { passwordHash });
  }

  async clearAutoCreatedAt(userId: string): Promise<void> {
    await this.userRepository.update({ id: userId }, { autoCreatedAt: null });
  }

  async updateProfile(
    userId: string,
    data: { name?: string; phone?: string },
  ): Promise<User> {
    const user = await this.findByIdOrFail(userId);
    if (data.name !== undefined) {
      const trimmed = data.name.trim();
      if (!trimmed) {
        throw new BadRequestException('Name cannot be empty');
      }
      user.name = trimmed;
    }
    if (data.phone !== undefined) {
      const trimmed = data.phone.trim();
      user.phone = trimmed || undefined;
    }
    return this.userRepository.save(user);
  }

  async closeAccount(userId: string): Promise<void> {
    const user = await this.findByIdOrFail(userId);
    user.status = UserStatus.CLOSED;
    user.closedAt = new Date();
    user.email = `closed.${user.id.replace(/-/g, '')}@closed.allaxs.internal`;
    user.name = 'Closed account';
    user.phone = undefined;
    user.passwordHash = undefined;
    user.autoCreatedAt = null;
    await this.userRepository.save(user);
  }

  /**
   * Ensures host upgrades are additive:
   * - keep ATTENDEE access (wallet, purchases)
   * - add ORGANIZER access (host tools)
   * Also repairs legacy organizer-only role arrays.
   */
  /**
   * Find or create a user from a verified Google ID token (email pre-verified by Google).
   * Existing password accounts keep their password; Google can still be used to sign in.
   */
  async upsertGoogleOAuthUser(params: {
    email: string;
    name: string;
  }): Promise<User> {
    const email = params.email.trim().toLowerCase();
    if (!email) {
      throw new ConflictException('Email is required');
    }

    let user = await this.findByEmail(email);
    if (user) {
      if (isClosedAccount(user)) {
        throw new UnauthorizedException({
          message: 'This account has been closed.',
          code: 'accountClosed',
        });
      }
      if (user.status !== UserStatus.ACTIVE) {
        throw new UnauthorizedException({
          message: 'Account suspended. Please contact support.',
          code: 'accountSuspended',
        });
      }
      const nextName = params.name.trim();
      if (nextName && (!user.name || !user.name.trim())) {
        user.name = nextName;
        await this.userRepository.save(user);
      }
      return user;
    }

    const displayName =
      params.name.trim() || email.split('@')[0] || 'All AXS user';
    const created = this.userRepository.create({
      email,
      name: displayName,
      roles: [Role.ATTENDEE],
      status: UserStatus.ACTIVE,
    });
    return this.userRepository.save(created);
  }

  getNotificationPrefsForUser(user: User): UserNotificationPrefs {
    return normalizeNotificationPrefs(user.notificationPrefs);
  }

  async getNotificationPrefs(userId: string): Promise<UserNotificationPrefs> {
    const user = await this.findByIdOrFail(userId);
    return this.getNotificationPrefsForUser(user);
  }

  async getNotificationPrefsByEmail(
    email: string,
  ): Promise<UserNotificationPrefs> {
    const user = await this.findByEmail(email.trim().toLowerCase());
    if (!user) {
      return { ...DEFAULT_USER_NOTIFICATION_PREFS };
    }
    return this.getNotificationPrefsForUser(user);
  }

  async updateNotificationPrefs(
    userId: string,
    patch: Partial<UserNotificationPrefs>,
  ): Promise<UserNotificationPrefs> {
    const user = await this.findByIdOrFail(userId);
    const current = this.getNotificationPrefsForUser(user);
    const next = mergeNotificationPrefs(current, patch);
    user.notificationPrefs = next;
    await this.userRepository.save(user);
    return next;
  }

  /** Transactional order emails; default on when no account exists (guest checkout). */
  async shouldSendOrdersEmail(email: string): Promise<boolean> {
    const user = await this.findByEmail(email.trim().toLowerCase());
    if (!user) return true;
    return this.getNotificationPrefsForUser(user).ordersEmail;
  }

  /** Installment and event reminders. */
  async shouldSendReminders(email: string): Promise<boolean> {
    const user = await this.findByEmail(email.trim().toLowerCase());
    if (!user) return true;
    return this.getNotificationPrefsForUser(user).reminders;
  }

  async addOrganizerRole(userId: string): Promise<User> {
    const user = await this.findByIdOrFail(userId);
    const currentRoles = Array.isArray(user.roles) ? user.roles : [];
    const roleSet = new Set<Role>(currentRoles);
    roleSet.add(Role.ATTENDEE);
    roleSet.add(Role.ORGANIZER);
    const nextRoles = [...roleSet];

    const unchanged =
      currentRoles.length === nextRoles.length &&
      currentRoles.every((role) => roleSet.has(role));
    if (unchanged) {
      return user;
    }

    user.roles = nextRoles;
    return this.userRepository.save(user);
  }
}
