import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UnauthorizedException, NotFoundException } from '@nestjs/common';
import { OrganizerProfilesController } from './organizer-profiles.controller';
import { OrganizerProfilesService } from './organizer-profiles.service';
import { OrganizerProfile } from '../users/entities/organizer-profile.entity';
import { User } from '../users/entities/user.entity';
import { Role, PayoutMethod } from '../domain/enums';
import type { CurrentUser } from '../auth/decorators/current-user.decorator';

describe('OrganizerProfilesController', () => {
  let controller: OrganizerProfilesController;
  let service: jest.Mocked<OrganizerProfilesService>;

  const mockUser: CurrentUser = {
    id: 'user-id',
    email: 'user@example.com',
    roles: [Role.ATTENDEE],
  };

  const mockProfile: OrganizerProfile = {
    id: 'profile-id',
    userId: 'user-id',
    orgName: 'Test Org',
    legalName: 'Test Org Legal',
    website: 'https://test.org',
    supportEmail: 'support@test.org',
    supportPhone: '+1234567890',
    payoutMethod: PayoutMethod.BANK_ACCOUNT,
    bankName: 'Test Bank',
    bankAccountName: 'Test Account',
    bankAccountNumber: '123456789',
    verified: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as OrganizerProfile;

  beforeEach(async () => {
    const mockService = {
      findByUserId: jest.fn(),
      upsertForUser: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrganizerProfilesController],
      providers: [
        {
          provide: OrganizerProfilesService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<OrganizerProfilesController>(
      OrganizerProfilesController,
    );
    service = module.get(OrganizerProfilesService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getMyProfile', () => {
    it('should return organizer profile when found', async () => {
      service.findByUserId.mockResolvedValue(mockProfile);

      const result = await controller.getMyProfile(mockUser);

      expect(service.findByUserId).toHaveBeenCalledWith('user-id');
      expect(result).toEqual(mockProfile);
    });

    it('should throw NotFoundException when profile not found', async () => {
      service.findByUserId.mockResolvedValue(null);

      await expect(controller.getMyProfile(mockUser)).rejects.toThrow(
        NotFoundException,
      );
      expect(service.findByUserId).toHaveBeenCalledWith('user-id');
    });
  });

  describe('upsertMyProfile', () => {
    const createDto = {
      orgName: 'New Org',
      supportEmail: 'support@neworg.com',
      payoutMethod: PayoutMethod.MPESA,
      mpesaPaybill: '123456',
    };

    it('should create profile and return it', async () => {
      const newProfile = {
        ...mockProfile,
        ...createDto,
      } as OrganizerProfile;

      service.upsertForUser.mockResolvedValue(newProfile);

      const result = await controller.upsertMyProfile(mockUser, createDto);

      expect(service.upsertForUser).toHaveBeenCalledWith('user-id', createDto);
      expect(result).toEqual(newProfile);
    });

    it('should update existing profile and return it', async () => {
      const updatedProfile = {
        ...mockProfile,
        orgName: 'Updated Org',
      } as OrganizerProfile;

      service.upsertForUser.mockResolvedValue(updatedProfile);

      const result = await controller.upsertMyProfile(mockUser, {
        orgName: 'Updated Org',
        supportEmail: 'support@test.org',
      });

      expect(service.upsertForUser).toHaveBeenCalled();
      expect(result).toEqual(updatedProfile);
    });
  });
});
