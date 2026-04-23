import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { Role } from '../domain/enums';

describe('UsersService', () => {
  let service: UsersService;
  let repository: jest.Mocked<Repository<User>>;

  const mockUser: Partial<User> = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'test@example.com',
    name: 'Test User',
    passwordHash: '$2a$10$test',
    roles: [Role.ATTENDEE],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    repository = module.get(getRepositoryToken(User));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findByEmail', () => {
    it('should return user if found', async () => {
      repository.findOne.mockResolvedValue(mockUser as User);

      const result = await service.findByEmail('test@example.com');

      expect(result).toEqual(mockUser);
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
    });

    it('should return null if user not found', async () => {
      repository.findOne.mockResolvedValue(null);

      const result = await service.findByEmail('nonexistent@example.com');

      expect(result).toBeNull();
    });
  });

  describe('findById', () => {
    it('should return user if found', async () => {
      repository.findOne.mockResolvedValue(mockUser as User);

      const result = await service.findById(
        '123e4567-e89b-12d3-a456-426614174000',
      );

      expect(result).toEqual(mockUser);
    });

    it('should return null if user not found', async () => {
      repository.findOne.mockResolvedValue(null);

      const result = await service.findById('nonexistent-id');

      expect(result).toBeNull();
    });
  });

  describe('createUser', () => {
    it('should create and return a new user', async () => {
      repository.findOne.mockResolvedValue(null); // No existing user
      repository.create.mockReturnValue(mockUser as User);
      repository.save.mockResolvedValue(mockUser as User);

      const result = await service.createUser({
        email: 'test@example.com',
        name: 'Test User',
        passwordHash: '$2a$10$test',
      });

      expect(result).toEqual(mockUser);
      expect(repository.create).toHaveBeenCalled();
      expect(repository.save).toHaveBeenCalled();
    });

    it('should throw ConflictException if email already exists', async () => {
      repository.findOne.mockResolvedValue(mockUser as User);

      await expect(
        service.createUser({
          email: 'test@example.com',
          name: 'Test User',
          passwordHash: '$2a$10$test',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should use custom roles if provided', async () => {
      repository.findOne.mockResolvedValue(null);
      repository.create.mockReturnValue({
        ...mockUser,
        roles: [Role.ADMIN],
      } as User);
      repository.save.mockResolvedValue({
        ...mockUser,
        roles: [Role.ADMIN],
      } as User);

      const result = await service.createUser({
        email: 'admin@example.com',
        name: 'Admin User',
        passwordHash: '$2a$10$test',
        roles: [Role.ADMIN],
      });

      expect(result.roles).toContain(Role.ADMIN);
    });
  });

  describe('findByIdOrFail', () => {
    it('should return user if found', async () => {
      repository.findOne.mockResolvedValue(mockUser as User);

      const result = await service.findByIdOrFail(
        '123e4567-e89b-12d3-a456-426614174000',
      );

      expect(result).toEqual(mockUser);
    });

    it('should throw NotFoundException if user not found', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.findByIdOrFail('nonexistent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
