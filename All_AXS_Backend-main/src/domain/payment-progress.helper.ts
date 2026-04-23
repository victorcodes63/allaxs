import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentPlan, PaymentPlanStatus } from './payment-plan.entity';
import {
  PaymentInstallment,
  PaymentInstallmentStatus,
} from './payment-installment.entity';

export interface PaymentProgress {
  total: number;
  paid: number;
  count: number;
  paidCount: number;
  completed: boolean;
  firstPaid: boolean;
  nextDueAt?: Date;
}

@Injectable()
export class PaymentProgressHelper {
  constructor(
    @InjectRepository(PaymentPlan)
    private readonly paymentPlanRepository: Repository<PaymentPlan>,
    @InjectRepository(PaymentInstallment)
    private readonly installmentRepository: Repository<PaymentInstallment>,
  ) {}

  /**
   * Get payment progress for an order
   * Returns progress based on PaymentPlan and PaymentInstallments only
   */
  async getOrderPaymentProgress(
    orderId: string,
  ): Promise<PaymentProgress | null> {
    const plan = await this.paymentPlanRepository.findOne({
      where: { orderId },
      relations: ['installments'],
      order: { installments: { sequence: 'ASC' } },
    });

    if (!plan) {
      return null;
    }

    const installments = plan.installments || [];
    const paidInstallments = installments.filter(
      (i) => i.status === PaymentInstallmentStatus.PAID,
    );
    const paidCount = paidInstallments.length;
    const count = installments.length;
    const total = plan.totalAmount;
    const paid = paidInstallments.reduce((sum, i) => sum + i.amount, 0);
    const completed =
      plan.status === PaymentPlanStatus.COMPLETED || paidCount === count;
    const firstPaid = paidCount > 0;

    // Find next due date from pending installments
    const nextPending = installments
      .filter((i) => i.status === PaymentInstallmentStatus.PENDING)
      .sort((a, b) => a.sequence - b.sequence)[0];

    return {
      total,
      paid,
      count,
      paidCount,
      completed,
      firstPaid,
      nextDueAt: nextPending?.dueAt,
    };
  }

  /**
   * Compute payment progress from a plan and its installments
   */
  computeProgress(
    plan: PaymentPlan,
    installments: PaymentInstallment[],
  ): PaymentProgress {
    const paidInstallments = installments.filter(
      (i) => i.status === PaymentInstallmentStatus.PAID,
    );
    const paidCount = paidInstallments.length;
    const count = installments.length;
    const total = plan.totalAmount;
    const paid = paidInstallments.reduce((sum, i) => sum + i.amount, 0);
    const completed =
      plan.status === PaymentPlanStatus.COMPLETED || paidCount === count;
    const firstPaid = paidCount > 0;

    const nextPending = installments
      .filter((i) => i.status === PaymentInstallmentStatus.PENDING)
      .sort((a, b) => a.sequence - b.sequence)[0];

    return {
      total,
      paid,
      count,
      paidCount,
      completed,
      firstPaid,
      nextDueAt: nextPending?.dueAt,
    };
  }
}
