import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { Role } from 'src/domain/enums';

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

  /**
   * Ensures host upgrades are additive:
   * - keep ATTENDEE access (wallet, purchases)
   * - add ORGANIZER access (host tools)
   * Also repairs legacy organizer-only role arrays.
   */
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
