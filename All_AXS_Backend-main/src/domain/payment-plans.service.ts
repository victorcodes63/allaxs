import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { PaymentPlan, PaymentPlanStatus } from './payment-plan.entity';
import {
  PaymentInstallment,
  PaymentInstallmentStatus,
} from './payment-installment.entity';
import { Order } from './order.entity';
import { OrderStatus } from './enums';
import { TicketType } from 'src/events/entities/ticket-type.entity';
import { OrderItem } from './order-item.entity';
import { Ticket } from './ticket.entity';
import { PaymentProgressHelper } from './payment-progress.helper';

@Injectable()
export class PaymentPlansService {
  private readonly logger = new Logger(PaymentPlansService.name);

  constructor(
    @InjectRepository(PaymentPlan)
    private readonly paymentPlanRepository: Repository<PaymentPlan>,
    @InjectRepository(PaymentInstallment)
    private readonly installmentRepository: Repository<PaymentInstallment>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(TicketType)
    private readonly ticketTypeRepository: Repository<TicketType>,
    @InjectRepository(OrderItem)
    private readonly orderItemRepository: Repository<OrderItem>,
    @InjectRepository(Ticket)
    private readonly ticketRepository: Repository<Ticket>,
    private readonly dataSource: DataSource,
    private readonly paymentProgressHelper: PaymentProgressHelper,
  ) {}

  /**
   * Create a payment plan for an order with installments
   */
  async createPaymentPlan(
    orderId: string,
    ticketTypeId: string,
    totalAmountCents: number,
    currency: string,
    config: {
      mode: 'PERCENT_SPLITS';
      splits: Array<{
        seq: number;
        pct: number;
        dueAfterDays: number;
      }>;
      gracePeriodDays?: number;
      autoCancelOnDefault?: boolean;
    },
    orderCreatedAt: Date,
  ): Promise<PaymentPlan> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const ticketType = await this.ticketTypeRepository.findOne({
      where: { id: ticketTypeId },
    });
    if (!ticketType) {
      throw new NotFoundException('Ticket type not found');
    }

    // Sort splits by sequence
    const sortedSplits = [...config.splits].sort((a, b) => a.seq - b.seq);

    // Calculate installment amounts (in minor units, remainder on last)
    const installments: Array<{
      sequence: number;
      amount: number;
      pct: number;
      dueAt: Date;
    }> = [];

    let remainingAmount = totalAmountCents;
    for (let i = 0; i < sortedSplits.length; i++) {
      const split = sortedSplits[i];
      const isLast = i === sortedSplits.length - 1;

      let amount: number;
      if (isLast) {
        // Last installment gets the remainder
        amount = remainingAmount;
      } else {
        // Calculate based on percentage
        amount = Math.round((totalAmountCents * split.pct) / 100);
        remainingAmount -= amount;
      }

      const dueAt = new Date(orderCreatedAt);
      dueAt.setDate(dueAt.getDate() + split.dueAfterDays);

      installments.push({
        sequence: split.seq,
        amount,
        pct: split.pct,
        dueAt,
      });
    }

    // Create payment plan
    const plan = this.paymentPlanRepository.create({
      orderId: order.id,
      ticketTypeId: ticketType.id,
      totalAmount: totalAmountCents,
      currency,
      status: PaymentPlanStatus.ACTIVE,
      nextDueAt: installments[0]?.dueAt,
      gracePeriodDays: config.gracePeriodDays,
      autoCancelOnDefault: config.autoCancelOnDefault || false,
    });

    const savedPlan = await this.paymentPlanRepository.save(plan);

    // Create installments
    const installmentEntities = installments.map((inst) =>
      this.installmentRepository.create({
        planId: savedPlan.id,
        sequence: inst.sequence,
        amount: inst.amount,
        pct: inst.pct,
        dueAt: inst.dueAt,
        status: PaymentInstallmentStatus.PENDING,
      }),
    );

    await this.installmentRepository.save(installmentEntities);

    // Reload with relations
    return this.paymentPlanRepository.findOne({
      where: { id: savedPlan.id },
      relations: ['installments'],
    }) as Promise<PaymentPlan>;
  }

  /**
   * Mark an installment as paid (test simulation only)
   */
  async markInstallmentPaid(
    orderId: string,
    sequence: number,
  ): Promise<{ plan: PaymentPlan; order: Order }> {
    if (process.env.NODE_ENV === 'production') {
      throw new BadRequestException(
        'This endpoint is only available in non-production environments',
      );
    }

    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['paymentPlans', 'paymentPlans.installments', 'items'],
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const plan = order.paymentPlans?.[0];
    if (!plan) {
      throw new NotFoundException('Payment plan not found for this order');
    }

    const installment = plan.installments.find((i) => i.sequence === sequence);
    if (!installment) {
      throw new NotFoundException(
        `Installment with sequence ${sequence} not found`,
      );
    }

    if (installment.status === PaymentInstallmentStatus.PAID) {
      throw new BadRequestException('Installment is already paid');
    }

    return await this.dataSource.transaction(async (manager) => {
      // Mark installment as paid
      installment.status = PaymentInstallmentStatus.PAID;
      installment.paidAt = new Date();
      await manager.save(installment);

      // Reload installments to get updated status
      const updatedInstallments = await manager.find(PaymentInstallment, {
        where: { planId: plan.id },
        order: { sequence: 'ASC' },
      });

      // Check if this is the first paid installment
      const progress = this.paymentProgressHelper.computeProgress(
        plan,
        updatedInstallments,
      );
      const isFirstPaid = progress.firstPaid && progress.paidCount === 1;

      if (isFirstPaid) {
        // First payment: reserve inventory (do NOT set order.status)
        // Reserve inventory (decrement quantitySold for each order item)
        for (const item of order.items) {
          const ticketType = await manager.findOne(TicketType, {
            where: { id: item.ticketTypeId },
          });
          if (ticketType) {
            ticketType.quantitySold += item.qty;
            await manager.save(ticketType);
          }
        }
      }

      // Check if all installments are paid (use updated installments)
      const allPaid = updatedInstallments.every(
        (i) => i.status === PaymentInstallmentStatus.PAID,
      );

      if (allPaid) {
        // All paid: complete plan, set order to PAID, issue tickets
        plan.status = PaymentPlanStatus.COMPLETED;
        plan.nextDueAt = undefined;
        await manager.save(plan);

        order.status = OrderStatus.PAID;
        await manager.save(order);

        // Issue tickets (reuse existing ticket issuance logic)
        // TODO: Integrate with existing ticket issuance service
        for (const item of order.items) {
          for (let i = 0; i < item.qty; i++) {
            // Generate QR code data
            const qrNonce = `qr_${Date.now()}_${Math.random().toString(36).substring(7)}`;
            const qrSignature = `sig_${Date.now()}_${Math.random().toString(36).substring(7)}`;

            const ticket = manager.create(Ticket, {
              orderId: order.id,
              ticketTypeId: item.ticketTypeId,
              ownerUserId: order.userId || undefined,
              attendeeName: undefined,
              attendeeEmail: order.email,
              attendeePhone: order.phone,
              qrNonce,
              qrSignature,
            });
            await manager.save(ticket);
          }
        }
      } else {
        // Update next due date (use updated installments)
        const nextPending = updatedInstallments
          .filter((i) => i.status === PaymentInstallmentStatus.PENDING)
          .sort((a, b) => a.sequence - b.sequence)[0];

        if (nextPending) {
          plan.nextDueAt = nextPending.dueAt;
          await manager.save(plan);
        }
      }

      // Reload plan with updated installments
      const updatedPlan = await manager.findOne(PaymentPlan, {
        where: { id: plan.id },
        relations: ['installments'],
        order: { installments: { sequence: 'ASC' } },
      });

      const updatedOrder = await manager.findOne(Order, {
        where: { id: order.id },
        relations: ['items', 'tickets'],
      });

      return {
        plan: updatedPlan!,
        order: updatedOrder!,
      };
    });
  }

  /**
   * Mark payment plan as defaulted (test simulation only)
   */
  async markDefaulted(
    orderId: string,
  ): Promise<{ plan: PaymentPlan; order: Order }> {
    if (process.env.NODE_ENV === 'production') {
      throw new BadRequestException(
        'This endpoint is only available in non-production environments',
      );
    }

    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['paymentPlans', 'paymentPlans.installments', 'items'],
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const plan = order.paymentPlans?.[0];
    if (!plan) {
      throw new NotFoundException('Payment plan not found for this order');
    }

    return await this.dataSource.transaction(async (manager) => {
      // Mark plan as defaulted
      plan.status = PaymentPlanStatus.DEFAULTED;
      plan.nextDueAt = undefined;
      await manager.save(plan);

      // Cancel order
      order.status = OrderStatus.CANCELLED;
      await manager.save(order);

      // Restock inventory (increment quantitySold back)
      for (const item of order.items) {
        const ticketType = await manager.findOne(TicketType, {
          where: { id: item.ticketTypeId },
        });
        if (ticketType) {
          ticketType.quantitySold = Math.max(
            0,
            ticketType.quantitySold - item.qty,
          );
          await manager.save(ticketType);
        }
      }

      // Cancel remaining installments
      const pendingInstallments = plan.installments.filter(
        (i) => i.status === PaymentInstallmentStatus.PENDING,
      );
      for (const installment of pendingInstallments) {
        installment.status = PaymentInstallmentStatus.CANCELLED;
        await manager.save(installment);
      }

      // Reload
      const updatedPlan = await manager.findOne(PaymentPlan, {
        where: { id: plan.id },
        relations: ['installments'],
      });

      const updatedOrder = await manager.findOne(Order, {
        where: { id: order.id },
      });

      return {
        plan: updatedPlan!,
        order: updatedOrder!,
      };
    });
  }

  /**
   * Get payment plan for an order
   */
  async findByOrder(orderId: string): Promise<PaymentPlan | null> {
    return this.paymentPlanRepository.findOne({
      where: { orderId },
      relations: ['installments'],
      order: { installments: { sequence: 'ASC' } },
    });
  }
}
