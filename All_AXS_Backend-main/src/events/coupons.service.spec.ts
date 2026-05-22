import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { CouponsService } from './coupons.service';
import { Coupon } from './entities/coupon.entity';
import { CouponRedemption } from 'src/domain/coupon-redemption.entity';
import { AdminAuditLog } from 'src/admin/entities/admin-audit-log.entity';
import { EventsService } from './events.service';
import { CouponType } from 'src/domain/enums';

function buildCoupon(overrides: Partial<Coupon> = {}): Coupon {
  return {
    id: 'coupon-id',
    code: 'SAVE20',
    kind: CouponType.PERCENT,
    percentOff: 20,
    eventId: 'event-id',
    active: true,
    usedCount: 0,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  } as Coupon;
}

const baseInput = {
  code: 'save20',
  eventId: 'event-id',
  userId: 'user-id' as string | null,
  email: 'buyer@example.com' as string | null,
  subtotalCents: 10_000,
  currency: 'KES',
};

describe('CouponsService', () => {
  let service: CouponsService;
  let couponRepository: jest.Mocked<Pick<Repository<Coupon>, 'findOne'>>;
  let redemptionRepository: jest.Mocked<Pick<Repository<CouponRedemption>, 'count'>>;

  beforeEach(async () => {
    couponRepository = { findOne: jest.fn() };
    redemptionRepository = { count: jest.fn().mockResolvedValue(0) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CouponsService,
        { provide: getRepositoryToken(Coupon), useValue: couponRepository },
        { provide: getRepositoryToken(CouponRedemption), useValue: redemptionRepository },
        { provide: getRepositoryToken(AdminAuditLog), useValue: { create: jest.fn(), save: jest.fn() } },
        { provide: EventsService, useValue: { ensureOwnership: jest.fn() } },
      ],
    }).compile();

    service = module.get(CouponsService);
  });

  describe('validateForOrder (COUPONS_SPEC §3)', () => {
    it('returns NOT_FOUND when code does not exist', async () => {
      couponRepository.findOne.mockResolvedValue(null);
      const result = await service.validateForOrder(baseInput);
      expect(result).toEqual(
        expect.objectContaining({ valid: false, errorCode: 'NOT_FOUND' }),
      );
    });

    it('returns INACTIVE when coupon is disabled', async () => {
      couponRepository.findOne.mockResolvedValue(buildCoupon({ active: false }));
      const result = await service.validateForOrder(baseInput);
      expect(result).toEqual(
        expect.objectContaining({ valid: false, errorCode: 'INACTIVE' }),
      );
    });

    it('returns WRONG_EVENT when coupon belongs to another event', async () => {
      couponRepository.findOne.mockResolvedValue(buildCoupon({ eventId: 'other-event' }));
      const result = await service.validateForOrder(baseInput);
      expect(result).toEqual(
        expect.objectContaining({ valid: false, errorCode: 'WRONG_EVENT' }),
      );
    });

    it('returns CURRENCY_MISMATCH when order currency differs', async () => {
      couponRepository.findOne.mockResolvedValue(buildCoupon({ currency: 'USD' }));
      const result = await service.validateForOrder(baseInput);
      expect(result).toEqual(
        expect.objectContaining({ valid: false, errorCode: 'CURRENCY_MISMATCH' }),
      );
    });

    it('returns NOT_STARTED when startAt is in the future', async () => {
      couponRepository.findOne.mockResolvedValue(
        buildCoupon({ startAt: new Date(Date.now() + 86_400_000) }),
      );
      const result = await service.validateForOrder(baseInput);
      expect(result).toEqual(
        expect.objectContaining({ valid: false, errorCode: 'NOT_STARTED' }),
      );
    });

    it('returns EXPIRED when endAt is in the past', async () => {
      couponRepository.findOne.mockResolvedValue(
        buildCoupon({ endAt: new Date(Date.now() - 86_400_000) }),
      );
      const result = await service.validateForOrder(baseInput);
      expect(result).toEqual(
        expect.objectContaining({ valid: false, errorCode: 'EXPIRED' }),
      );
    });

    it('returns EXHAUSTED when usedCount reached usageLimit', async () => {
      couponRepository.findOne.mockResolvedValue(
        buildCoupon({ usageLimit: 5, usedCount: 5 }),
      );
      const result = await service.validateForOrder(baseInput);
      expect(result).toEqual(
        expect.objectContaining({ valid: false, errorCode: 'EXHAUSTED' }),
      );
    });

    it('returns MIN_ORDER when subtotal is below minOrderCents', async () => {
      couponRepository.findOne.mockResolvedValue(
        buildCoupon({ minOrderCents: 50_000, currency: 'KES' }),
      );
      const result = await service.validateForOrder(baseInput);
      expect(result).toEqual(
        expect.objectContaining({ valid: false, errorCode: 'MIN_ORDER' }),
      );
    });

    it('returns PER_USER_EXHAUSTED when buyer reached perUserLimit', async () => {
      couponRepository.findOne.mockResolvedValue(buildCoupon({ perUserLimit: 1 }));
      redemptionRepository.count.mockResolvedValue(1);
      const result = await service.validateForOrder(baseInput);
      expect(result).toEqual(
        expect.objectContaining({ valid: false, errorCode: 'PER_USER_EXHAUSTED' }),
      );
    });

    it('accepts a valid PERCENT coupon and computes discount', async () => {
      couponRepository.findOne.mockResolvedValue(buildCoupon({ percentOff: 20 }));
      const result = await service.validateForOrder(baseInput);
      expect(result).toEqual({
        valid: true,
        coupon: expect.objectContaining({ code: 'SAVE20' }),
        discountCents: 2000,
      });
    });

    it('caps FIXED discount at subtotal without rejecting', async () => {
      couponRepository.findOne.mockResolvedValue(
        buildCoupon({
          kind: CouponType.FIXED,
          valueCents: 50_000,
          percentOff: undefined,
        }),
      );
      const result = await service.validateForOrder(baseInput);
      expect(result).toEqual({
        valid: true,
        coupon: expect.objectContaining({ kind: CouponType.FIXED }),
        discountCents: 10_000,
      });
    });

    it('matches codes case-insensitively', async () => {
      couponRepository.findOne.mockResolvedValue(buildCoupon({ code: 'EARLY2026' }));
      await service.validateForOrder({ ...baseInput, code: 'early2026' });
      expect(couponRepository.findOne).toHaveBeenCalledWith({
        where: { code: 'EARLY2026' },
      });
    });
  });

  describe('redeem concurrency (usageLimit = 1)', () => {
    it('allows the first checkout and rejects the second with COUPON_FULLY_REDEEMED semantics', async () => {
      let usedCount = 0;
      const coupon = buildCoupon({ usageLimit: 1, usedCount: 0, percentOff: 20 });

      const manager = {
        findOne: jest.fn(async (entity: unknown) => {
          if (entity === Coupon) {
            return { ...coupon, usedCount };
          }
          return null;
        }),
        save: jest.fn(async (entity: Coupon) => {
          if (typeof entity.usedCount === 'number') {
            usedCount = entity.usedCount;
          }
          return entity;
        }),
        create: jest.fn((_entity: unknown, data: unknown) => data),
        getRepository: jest.fn(() => redemptionRepository),
      } as unknown as EntityManager;

      const redeemInput = {
        code: 'SAVE20',
        eventId: 'event-id',
        orderId: 'order-1',
        userId: 'user-id',
        email: 'buyer@example.com',
        subtotalCents: 10_000,
        currency: 'KES',
      };

      const first = await service.redeem(manager, redeemInput);
      expect(first.discountCents).toBe(2000);
      expect(usedCount).toBe(1);

      await expect(
        service.redeem(manager, { ...redeemInput, orderId: 'order-2' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(usedCount).toBe(1);
    });

    it('rejects redemption when the cap was exhausted under lock', async () => {
      const coupon = buildCoupon({ usageLimit: 1, usedCount: 1, percentOff: 20 });
      const manager = {
        findOne: jest.fn(async () => ({ ...coupon })),
        save: jest.fn(),
        create: jest.fn(),
        getRepository: jest.fn(() => redemptionRepository),
      } as unknown as EntityManager;

      await expect(
        service.redeem(manager, {
          code: 'SAVE20',
          eventId: 'event-id',
          orderId: 'order-race',
          userId: null,
          email: 'buyer@example.com',
          subtotalCents: 10_000,
          currency: 'KES',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('rollbackRedemption', () => {
    it('decrements usedCount and removes the redemption row', async () => {
      const redemption = {
        id: 'redemption-id',
        couponId: 'coupon-id',
        orderId: 'order-id',
      } as CouponRedemption;
      const coupon = buildCoupon({ usedCount: 1 });

      const manager = {
        findOne: jest
          .fn()
          .mockResolvedValueOnce(redemption)
          .mockResolvedValueOnce(coupon),
        save: jest.fn(),
        remove: jest.fn(),
      } as unknown as EntityManager;

      await service.rollbackRedemption(manager, 'order-id');

      expect(manager.save).toHaveBeenCalledWith(
        expect.objectContaining({ usedCount: 0 }),
      );
      expect(manager.remove).toHaveBeenCalledWith(redemption);
    });

    it('no-ops when no redemption exists for the order', async () => {
      const manager = {
        findOne: jest.fn().mockResolvedValue(null),
        save: jest.fn(),
        remove: jest.fn(),
      } as unknown as EntityManager;

      await service.rollbackRedemption(manager, 'order-id');

      expect(manager.save).not.toHaveBeenCalled();
      expect(manager.remove).not.toHaveBeenCalled();
    });
  });
});
