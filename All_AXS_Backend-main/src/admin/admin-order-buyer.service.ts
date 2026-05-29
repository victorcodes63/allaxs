import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Order } from '../domain/order.entity';
import { Ticket } from '../domain/ticket.entity';
import { OrderStatus } from '../domain/enums';
import { UsersService } from '../users/users.service';
import { CheckoutService } from '../checkout/checkout.service';
import { ReassignOrderBuyerDto } from './dto/reassign-order-buyer.dto';

function parseBuyerNameFromNotes(notes: string | null | undefined): string {
  if (!notes) return '';
  try {
    const meta = JSON.parse(notes) as { buyerName?: string };
    return (meta.buyerName ?? '').trim();
  } catch {
    return '';
  }
}

@Injectable()
export class AdminOrderBuyerService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly usersService: UsersService,
    private readonly checkoutService: CheckoutService,
  ) {}

  /**
   * Move a paid order (and its tickets) from a typo/incorrect checkout email
   * to the buyer's correct address. Links the order to an active attendee
   * account for the new email, creating one when needed.
   */
  async reassignBuyerEmail(
    orderId: string,
    dto: ReassignOrderBuyerDto,
  ): Promise<{
    orderId: string;
    previousEmail: string;
    newEmail: string;
    userId: string;
    ticketCount: number;
    ticketsResent: boolean;
  }> {
    const newEmail = dto.newEmail.trim().toLowerCase();
    if (!newEmail) {
      throw new BadRequestException('New buyer email is required');
    }

    const order = await this.dataSource.getRepository(Order).findOne({
      where: { id: orderId },
      relations: ['tickets'],
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    if (order.status !== OrderStatus.PAID) {
      throw new BadRequestException(
        'Buyer email can only be reassigned on paid orders',
      );
    }
    if (!order.tickets?.length) {
      throw new BadRequestException('This order has no issued tickets');
    }

    const previousEmail = order.email.trim().toLowerCase();
    if (previousEmail === newEmail) {
      throw new BadRequestException(
        'New email matches the current buyer email on this order',
      );
    }

    const buyerName = parseBuyerNameFromNotes(order.notes);
    const targetUser = await this.usersService.ensureActiveAttendeeBuyer(
      newEmail,
      { name: buyerName || undefined },
    );

    const ticketCount = order.tickets.length;

    await this.dataSource.transaction(async (manager) => {
      order.email = newEmail;
      order.userId = targetUser.id;
      await manager.save(order);

      await manager.update(
        Ticket,
        { orderId: order.id },
        {
          attendeeEmail: newEmail,
          ownerUserId: targetUser.id,
        },
      );
    });

    const shouldResend = dto.resendTickets !== false;
    if (shouldResend) {
      await this.checkoutService.adminResendOrderTickets(orderId);
    }

    return {
      orderId: order.id,
      previousEmail,
      newEmail,
      userId: targetUser.id,
      ticketCount,
      ticketsResent: shouldResend,
    };
  }
}
