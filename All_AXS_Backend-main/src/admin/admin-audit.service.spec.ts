import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminAuditService } from './admin-audit.service';
import { AdminAuditLog } from './entities/admin-audit-log.entity';

describe('AdminAuditService', () => {
  let service: AdminAuditService;
  let repository: jest.Mocked<Repository<AdminAuditLog>>;

  beforeEach(async () => {
    const mockRepository = {
      create: jest.fn(),
      save: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminAuditService,
        {
          provide: getRepositoryToken(AdminAuditLog),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<AdminAuditService>(AdminAuditService);
    repository = module.get(getRepositoryToken(AdminAuditLog));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('logAction', () => {
    it('should create and save an audit log entry', async () => {
      const mockAuditLog = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        adminUserId: 'admin-id',
        action: 'APPROVE_EVENT',
        resourceType: 'event',
        resourceId: 'event-id',
        metadata: { test: 'data' },
        ipAddress: '127.0.0.1',
        userAgent: 'Test Agent',
        status: 'SUCCESS',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      repository.create.mockReturnValue(mockAuditLog as AdminAuditLog);
      repository.save.mockResolvedValue(mockAuditLog as AdminAuditLog);

      await service.logAction({
        adminUserId: 'admin-id',
        action: 'APPROVE_EVENT',
        resourceType: 'event',
        resourceId: 'event-id',
        metadata: { test: 'data' },
        ipAddress: '127.0.0.1',
        userAgent: 'Test Agent',
        status: 'SUCCESS',
      });

      expect(repository.create).toHaveBeenCalledWith({
        adminUserId: 'admin-id',
        action: 'APPROVE_EVENT',
        resourceType: 'event',
        resourceId: 'event-id',
        metadata: { test: 'data' },
        ipAddress: '127.0.0.1',
        userAgent: 'Test Agent',
        status: 'SUCCESS',
      });
      expect(repository.save).toHaveBeenCalledWith(mockAuditLog);
    });

    it('should handle null values for optional fields', async () => {
      const mockAuditLog = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        adminUserId: 'admin-id',
        action: 'APPROVE_EVENT',
        resourceType: 'event',
        resourceId: null,
        metadata: undefined,
        ipAddress: null,
        userAgent: null,
        status: 'SUCCESS',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      repository.create.mockReturnValue(mockAuditLog as AdminAuditLog);
      repository.save.mockResolvedValue(mockAuditLog as AdminAuditLog);

      await service.logAction({
        adminUserId: 'admin-id',
        action: 'APPROVE_EVENT',
        resourceType: 'event',
      });

      expect(repository.create).toHaveBeenCalledWith({
        adminUserId: 'admin-id',
        action: 'APPROVE_EVENT',
        resourceType: 'event',
        resourceId: null,
        metadata: undefined,
        ipAddress: null,
        userAgent: null,
        status: 'SUCCESS',
      });
    });
  });
});
