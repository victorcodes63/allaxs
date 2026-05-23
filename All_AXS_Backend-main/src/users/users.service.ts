import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { Role, UserStatus } from 'src/domain/enums';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
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
    user.status = UserStatus.SUSPENDED;
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
