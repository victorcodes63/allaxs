import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('health', () => {
    it('should return health status with ok: true', () => {
      const result = controller.health();
      expect(result).toHaveProperty('ok', true);
      expect(result).toHaveProperty('service', 'all-axs-api');
      expect(result).toHaveProperty('ts');
      expect(result.ts).toMatch(/^\d{4}-\d{2}-\d{2}T/); // ISO date format
    });
  });

  describe('version', () => {
    it('should return version information', () => {
      const result = controller.version();
      expect(result).toHaveProperty('version');
      expect(result.version).toBe('0.1.0');
    });
  });
});
