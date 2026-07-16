import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { OrganizerProfile } from '../users/entities/organizer-profile.entity';
import { Order } from '../domain/order.entity';
import { Role, UserStatus } from '../domain/enums';
import {
  gmailLocalPartDotCount,
} from '../common/email-normalization';
import { looksLikeBotDisplayName } from '../common/human-name-validation';
import { AuthService } from '../auth/auth.service';

export type BotCleanupCandidate = {
  id: string;
  email: string;
  name: string | null;
  createdAt: Date;
  reasons: string[];
};

@Injectable()
export class AdminBotCleanupService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(OrganizerProfile)
    private readonly organizerProfileRepository: Repository<OrganizerProfile>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly authService: AuthService,
  ) {}

  async findLikelyBotAccounts(limit = 500): Promise<BotCleanupCandidate[]> {
    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const users = await this.userRepository
      .createQueryBuilder('u')
      .where('u.status = :status', { status: UserStatus.ACTIVE })
      .andWhere('NOT (:admin = ANY(u.roles))', { admin: Role.ADMIN })
      .andWhere('u.createdAt >= :since', { since })
      .orderBy('u.createdAt', 'DESC')
      .limit(Math.min(limit, 2000))
      .getMany();

    const candidates: BotCleanupCandidate[] = [];

    for (const user of users) {
      const reasons: string[] = [];
      const dotCount = gmailLocalPartDotCount(user.email);
      if (dotCount >= 3) {
        reasons.push(`gmail_dot_alias_${dotCount}`);
      }
      if (looksLikeBotDisplayName(user.name)) {
        reasons.push('random_display_name');
      }
      if (reasons.length === 0) continue;

      const orderCount = await this.orderRepository.count({
        where: { userId: user.id },
      });
      if (orderCount > 0) continue;

      const profile = await this.organizerProfileRepository.findOne({
        where: { userId: user.id },
      });
      if (profile?.verified) continue;

      candidates.push({
        id: user.id,
        email: user.email,
        name: user.name ?? null,
        createdAt: user.createdAt,
        reasons,
      });
    }

    return candidates;
  }

  async suspendLikelyBots(options: {
    dryRun: boolean;
    limit?: number;
  }): Promise<{
    dryRun: boolean;
    matched: number;
    suspended: number;
    items: BotCleanupCandidate[];
  }> {
    const items = await this.findLikelyBotAccounts(options.limit ?? 500);
    if (options.dryRun) {
      return {
        dryRun: true,
        matched: items.length,
        suspended: 0,
        items,
      };
    }

    let suspended = 0;
    for (const item of items) {
      const user = await this.userRepository.findOne({ where: { id: item.id } });
      if (!user || user.status !== UserStatus.ACTIVE) continue;
      user.status = UserStatus.SUSPENDED;
      await this.userRepository.save(user);
      await this.authService.forceSignOutUser(
        user.id,
        'Bulk suspend: likely bot account',
      );
      suspended++;
    }

    return {
      dryRun: false,
      matched: items.length,
      suspended,
      items,
    };
  }
}
