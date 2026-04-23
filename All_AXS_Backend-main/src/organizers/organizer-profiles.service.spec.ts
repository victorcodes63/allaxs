import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrganizerProfilesService } from './organizer-profiles.service';
import { OrganizerProfile } from '../users/entities/organizer-profile.entity';
import { User } from '../users/entities/user.entity';
import { Role, PayoutMethod } from '../domain/enums';

describe('OrganizerProfilesService', () => {
  let service: OrganizerProfilesService;
  let organizerProfileRepository: jest.Mocked<Repository<OrganizerProfile>>;
  let userRepository: jest.Mocked<Repository<User>>;

  const mockUser: User = {
    id: 'user-id',
    email: 'user@example.com',
    roles: [Role.ATTENDEE],
  } as User;

  const mockProfile: OrganizerProfile = {
    id: 'profile-id',
    userId: 'user-id',
    orgName: 'Test Org',
    supportEmail: 'support@test.org',
    verified: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as OrganizerProfile;

  beforeEach(async () => {
    const mockOrganizerProfileRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    const mockUserRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizerProfilesService,
        {
          provide: getRepositoryToken(OrganizerProfile),
          useValue: mockOrganizerProfileRepository,
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
      ],
    }).compile();

    service = module.get<OrganizerProfilesService>(OrganizerProfilesService);
    organizerProfileRepository = module.get(
      getRepositoryToken(OrganizerProfile),
    );
    userRepository = module.get(getRepositoryToken(User));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findByUserId', () => {
    it('should return profile when found', async () => {
      organizerProfileRepository.findOne.mockResolvedValue(mockProfile);

      const result = await service.findByUserId('user-id');

      expect(organizerProfileRepository.findOne).toHaveBeenCalledWith({
        where: { userId: 'user-id' },
      });
      expect(result).toEqual(mockProfile);
    });

    it('should return null when profile not found', async () => {
      organizerProfileRepository.findOne.mockResolvedValue(null);

      const result = await service.findByUserId('user-id');

      expect(result).toBeNull();
    });
  });

  describe('upsertForUser', () => {
    const createDto = {
      orgName: 'New Org',
      supportEmail: 'support@neworg.com',
      payoutMethod: PayoutMethod.BANK_ACCOUNT,
      bankName: 'Test Bank',
    };

    it('should create new profile and add ORGANIZER role to user', async () => {
      organizerProfileRepository.findOne.mockResolvedValue(null);
      organizerProfileRepository.create.mockReturnValue({
        ...mockProfile,
        ...createDto,
      } as OrganizerProfile);
      organizerProfileRepository.save.mockResolvedValue({
        ...mockProfile,
        ...createDto,
      } as OrganizerProfile);

      userRepository.findOne.mockResolvedValue(mockUser);
      userRepository.save.mockResolvedValue({
        ...mockUser,
        roles: [Role.ATTENDEE, Role.ORGANIZER],
      } as User);

      const result = await service.upsertForUser('user-id', createDto);

      expect(organizerProfileRepository.findOne).toHaveBeenCalled();
      expect(organizerProfileRepository.create).toHaveBeenCalledWith({
        userId: 'user-id',
        ...createDto,
      });
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'user-id' },
      });
      expect(userRepository.save).toHaveBeenCalledWith({
        ...mockUser,
        roles: [Role.ATTENDEE, Role.ORGANIZER],
      });
      expect(result).toBeDefined();
    });

    it('should update existing profile without changing user roles', async () => {
      const existingProfile = { ...mockProfile };
      organizerProfileRepository.findOne.mockResolvedValue(existingProfile);
      organizerProfileRepository.save.mockResolvedValue({
        ...existingProfile,
        orgName: 'Updated Org',
      } as OrganizerProfile);

      const result = await service.upsertForUser('user-id', {
        orgName: 'Updated Org',
        supportEmail: 'support@test.org',
      });

      expect(organizerProfileRepository.findOne).toHaveBeenCalled();
      expect(organizerProfileRepository.save).toHaveBeenCalled();
      expect(result.orgName).toBe('Updated Org');
    });

    it('should not add ORGANIZER role if user already has it', async () => {
      const userWithOrganizerRole = {
        ...mockUser,
        roles: [Role.ATTENDEE, Role.ORGANIZER],
      } as User;

      organizerProfileRepository.findOne.mockResolvedValue(null);
      organizerProfileRepository.create.mockReturnValue(mockProfile);
      organizerProfileRepository.save.mockResolvedValue(mockProfile);

      userRepository.findOne.mockResolvedValue(userWithOrganizerRole);

      await service.upsertForUser('user-id', createDto);

      expect(userRepository.save).not.toHaveBeenCalled();
    });

    it('should handle null/undefined user.roles safely when adding ORGANIZER role', async () => {
      const userWithNullRoles = {
        ...mockUser,
        roles: null as any,
      } as User;

      organizerProfileRepository.findOne.mockResolvedValue(null);
      organizerProfileRepository.create.mockReturnValue(mockProfile);
      organizerProfileRepository.save.mockResolvedValue(mockProfile);

      userRepository.findOne.mockResolvedValue(userWithNullRoles);
      userRepository.save.mockResolvedValue({
        ...userWithNullRoles,
        roles: [Role.ORGANIZER],
      } as User);

      await service.upsertForUser('user-id', createDto);

      expect(userRepository.save).toHaveBeenCalledWith({
        ...userWithNullRoles,
        roles: [Role.ORGANIZER],
      });
    });

    it('should map payoutInstructions to payoutDetails when creating profile', async () => {
      const dtoWithInstructions = {
        ...createDto,
        payoutInstructions: 'Send payment to account X',
      };

      organizerProfileRepository.findOne.mockResolvedValue(null);
      organizerProfileRepository.create.mockReturnValue({
        ...mockProfile,
        payoutDetails: { instructions: 'Send payment to account X' },
      } as OrganizerProfile);
      organizerProfileRepository.save.mockResolvedValue({
        ...mockProfile,
        payoutDetails: { instructions: 'Send payment to account X' },
      } as OrganizerProfile);

      userRepository.findOne.mockResolvedValue(mockUser);
      userRepository.save.mockResolvedValue({
        ...mockUser,
        roles: [Role.ATTENDEE, Role.ORGANIZER],
      } as User);

      await service.upsertForUser('user-id', dtoWithInstructions);

      expect(organizerProfileRepository.create).toHaveBeenCalledWith({
        userId: 'user-id',
        orgName: 'New Org',
        supportEmail: 'support@neworg.com',
        payoutMethod: PayoutMethod.BANK_ACCOUNT,
        bankName: 'Test Bank',
        payoutDetails: { instructions: 'Send payment to account X' },
      });
    });

    it('should map payoutInstructions to payoutDetails when updating profile', async () => {
      const existingProfile = {
        ...mockProfile,
        payoutDetails: { existing: 'data' },
      } as OrganizerProfile;

      organizerProfileRepository.findOne.mockResolvedValue(existingProfile);
      organizerProfileRepository.save.mockResolvedValue({
        ...existingProfile,
        orgName: 'Updated Org',
        payoutDetails: {
          existing: 'data',
          instructions: 'New payment instructions',
        },
      } as OrganizerProfile);

      const result = await service.upsertForUser('user-id', {
        orgName: 'Updated Org',
        supportEmail: 'support@test.org',
        payoutInstructions: 'New payment instructions',
      });

      expect(result.payoutDetails).toEqual({
        existing: 'data',
        instructions: 'New payment instructions',
      });
    });
  });
});
