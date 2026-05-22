import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { OrderRefundService } from './order-refund.service';
import { OrganizerLedgerService } from '../domain/organizer-ledger.service';
import { CouponsService } from '../events/coupons.service';
import { EmailService } from '../auth/services/email.service';
import { Order } from '../domain/order.entity';
import { TicketType } from '../events/entities/ticket-type.entity';
import { OrderStatus, TicketStatus } from '../domain/enums';

describe('OrderRefundService', () => {
  let service: OrderRefundService;
  let couponsService: jest.Mocked<Pick<CouponsService, 'rollbackRedemption'>>;
  let transactionManager: {
    findOne: jest.Mock;
    save: jest.Mock;
  };

  const paidOrder = {
    id: 'order-id',
    status: OrderStatus.PAID,
    amountCents: 8000,
    currency: 'KES',
    reference: 'demo_ref_abc',
    appliedCouponId: 'coupon-id',
    items: [{ ticketTypeId: 'tier-id', qty: 1 }],
    tickets: [{ id: 'ticket-id', status: TicketStatus.ISSUED }],
    payments: [],
    event: { organizer: { id: 'organizer-id' } },
  } as Order;

  beforeEach(async () => {
    couponsService = { rollbackRedemption: jest.fn().mockResolvedValue(undefined) };

    transactionManager = {
      findOne: jest.fn(async (entity: unknown, opts: { where: { id: string } }) => {
        if (entity === Order) {
          return { ...paidOrder, id: opts.where.id };
        }
        if (entity === TicketType) {
          return { id: opts.where.id, quantitySold: 1 };
        }
        return null;
      }),
      save: jest.fn(async (entity: unknown) => entity),
    };

    const dataSource = {
      getRepository: jest.fn(() => ({
        findOne: jest.fn().mockResolvedValue(paidOrder),
      })),
      transaction: jest.fn(async (cb: (manager: typeof transactionManager) => Promise<void>) =>
        cb(transactionManager),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderRefundService,
        { provide: DataSource, useValue: dataSource },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        {
          provide: OrganizerLedgerService,
          useValue: { ensureOrderRefundReversal: jest.fn().mockResolvedValue(undefined) },
        },
        { provide: CouponsService, useValue: couponsService },
        { provide: EmailService, useValue: { sendOrderRefundEmail: jest.fn() } },
      ],
    }).compile();

    service = module.get(OrderRefundService);
  });

  it('calls rollbackRedemption inside the refund transaction when a coupon was applied', async () => {
    const result = await service.refundPaidOrder('order-id', { reason: 'test refund' });

    expect(result.order.status).toBe(OrderStatus.REFUNDED);
    expect(couponsService.rollbackRedemption).toHaveBeenCalledWith(
      transactionManager,
      'order-id',
    );
  });

  it('skips coupon rollback when the order has no appliedCouponId', async () => {
    const orderWithoutCoupon = {
      ...paidOrder,
      appliedCouponId: null,
    };
    const dataSource = {
      getRepository: jest.fn(() => ({
        findOne: jest.fn().mockResolvedValue(orderWithoutCoupon),
      })),
      transaction: jest.fn(async (cb: (manager: typeof transactionManager) => Promise<void>) =>
        cb({
          ...transactionManager,
          findOne: jest.fn(async (entity: unknown) => {
            if (entity === Order) return orderWithoutCoupon;
            if (entity === TicketType) return { id: 'tier-id', quantitySold: 1 };
            return null;
          }),
        }),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderRefundService,
        { provide: DataSource, useValue: dataSource },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        {
          provide: OrganizerLedgerService,
          useValue: { ensureOrderRefundReversal: jest.fn().mockResolvedValue(undefined) },
        },
        { provide: CouponsService, useValue: couponsService },
        { provide: EmailService, useValue: { sendOrderRefundEmail: jest.fn() } },
      ],
    }).compile();

    const localService = module.get(OrderRefundService);
    await localService.refundPaidOrder('order-id', {});

    expect(couponsService.rollbackRedemption).not.toHaveBeenCalled();
  });
});
