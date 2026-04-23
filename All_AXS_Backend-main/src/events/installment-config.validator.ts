import {
  Injectable,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TicketType } from './entities/ticket-type.entity';
import { OrderItem } from 'src/domain/order-item.entity';
import { InstallmentConfigDto } from './dto/installment-config.dto';

export interface InstallmentConfig {
  mode: 'PERCENT_SPLITS';
  splits: Array<{
    seq: number;
    pct: number;
    dueAfterDays: number;
  }>;
  minDepositPct?: number;
  gracePeriodDays?: number;
  autoCancelOnDefault?: boolean;
}

@Injectable()
export class InstallmentConfigValidator {
  constructor(
    @InjectRepository(TicketType)
    private readonly ticketTypeRepository: Repository<TicketType>,
    @InjectRepository(OrderItem)
    private readonly orderItemRepository: Repository<OrderItem>,
  ) {}

  /**
   * Validate installment configuration
   * @param config Installment configuration
   * @param eventStartAt Event start date (to ensure final due date is before event)
   * @param ticketTypeId Optional ticket type ID to check for existing orders
   */
  async validate(
    config: InstallmentConfigDto,
    eventStartAt: Date,
    ticketTypeId?: string,
  ): Promise<void> {
    const splits = config.splits;

    // 1. At least 2 splits required
    if (splits.length < 2) {
      throw new BadRequestException('At least 2 payment splits are required');
    }

    // 2. Sum of percentages must equal 100
    const totalPct = splits.reduce((sum, split) => sum + split.pct, 0);
    if (Math.abs(totalPct - 100) > 0.01) {
      throw new BadRequestException(
        `Sum of percentages must equal 100% (got ${totalPct}%)`,
      );
    }

    // 3. Sequence numbers must be strictly increasing starting from 1
    const sortedSplits = [...splits].sort((a, b) => a.seq - b.seq);
    for (let i = 0; i < sortedSplits.length; i++) {
      if (sortedSplits[i].seq !== i + 1) {
        throw new BadRequestException(
          `Sequence numbers must be strictly increasing starting from 1 (got ${sortedSplits[i].seq} at position ${i + 1})`,
        );
      }
    }

    // Check for duplicate sequence numbers
    const seqSet = new Set(splits.map((s) => s.seq));
    if (seqSet.size !== splits.length) {
      throw new BadRequestException('Duplicate sequence numbers found');
    }

    // 4. dueAfterDays must be >= 0 and non-decreasing
    for (let i = 0; i < sortedSplits.length; i++) {
      if (sortedSplits[i].dueAfterDays < 0) {
        throw new BadRequestException(
          `dueAfterDays must be >= 0 (got ${sortedSplits[i].dueAfterDays} for sequence ${sortedSplits[i].seq})`,
        );
      }
      if (
        i > 0 &&
        sortedSplits[i].dueAfterDays < sortedSplits[i - 1].dueAfterDays
      ) {
        throw new BadRequestException(
          `dueAfterDays must be non-decreasing (got ${sortedSplits[i].dueAfterDays} < ${sortedSplits[i - 1].dueAfterDays})`,
        );
      }
    }

    // 5. First split percentage must be >= minDepositPct if provided
    if (config.minDepositPct !== undefined) {
      const firstSplit = sortedSplits[0];
      if (firstSplit.pct < config.minDepositPct) {
        throw new BadRequestException(
          `First split percentage (${firstSplit.pct}%) must be >= minimum deposit (${config.minDepositPct}%)`,
        );
      }
    }

    // 6. Final due date must be <= event start
    const finalSplit = sortedSplits[sortedSplits.length - 1];
    const finalDueDate = new Date(eventStartAt);
    finalDueDate.setDate(finalDueDate.getDate() - finalSplit.dueAfterDays);
    if (finalDueDate > eventStartAt) {
      throw new BadRequestException(
        `Final installment due date (${finalDueDate.toISOString()}) must be on or before event start (${eventStartAt.toISOString()})`,
      );
    }

    // 7. If ticketTypeId is provided, check if any orders exist for this ticket type
    // If so, throw 409 Conflict
    if (ticketTypeId) {
      const existingOrders = await this.orderItemRepository.count({
        where: { ticketTypeId },
      });

      if (existingOrders > 0) {
        throw new ConflictException(
          'Cannot modify installment configuration: orders already exist for this ticket type',
        );
      }
    }
  }

  /**
   * Validate that installment config can be modified (no existing orders)
   */
  async validateCanModify(ticketTypeId: string): Promise<void> {
    const existingOrders = await this.orderItemRepository.count({
      where: { ticketTypeId },
    });

    if (existingOrders > 0) {
      throw new ConflictException(
        'Cannot modify installment configuration: orders already exist for this ticket type',
      );
    }
  }
}
