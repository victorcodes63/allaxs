import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { LocalStorage } from './local-storage.driver';

// Mock fs/promises
jest.mock('fs/promises', () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
}));

import * as fs from 'fs/promises';

describe('LocalStorage', () => {
  let driver: LocalStorage;
  let configService: ConfigService;
  let mockMkdir: jest.Mock;
  let mockWriteFile: jest.Mock;

  beforeEach(async () => {
    mockMkdir = fs.mkdir as jest.Mock;
    mockWriteFile = fs.writeFile as jest.Mock;
    mockMkdir.mockClear();
    mockWriteFile.mockClear();
    mockMkdir.mockResolvedValue(undefined);
    mockWriteFile.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocalStorage,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: string) => {
              if (key === 'STATIC_BASE_URL') return defaultValue || '/static';
              return defaultValue;
            }),
          },
        },
      ],
    }).compile();

    driver = module.get<LocalStorage>(LocalStorage);
    configService = module.get<ConfigService>(ConfigService);
  });

  describe('initUpload', () => {
    it('should return direct upload mode', async () => {
      const result = await driver.initUpload({
        key: 'events/test-id/banner.jpg',
        contentType: 'image/jpeg',
        contentLength: 1024,
      });

      expect(result.mode).toBe('direct');
      if (result.mode === 'direct') {
        expect(result.directUpload).toBe(true);
        expect(result.finalPathHint).toBe('/static/events/test-id/banner.jpg');
      }
    });
  });

  describe('finalizeUrl', () => {
    it('should return static URL', () => {
      const url = driver.finalizeUrl('events/test-id/banner.jpg');
      expect(url).toBe('/static/events/test-id/banner.jpg');
    });
  });

  describe('saveDirect', () => {
    it('should save file and return URL', async () => {
      const mockFile = {
        buffer: Buffer.from('test'),
        mimetype: 'image/jpeg',
        size: 4,
      } as Express.Multer.File;

      const url = await driver.saveDirect({
        key: 'events/test-id/banner.jpg',
        file: mockFile,
      });

      expect(mockMkdir).toHaveBeenCalled();
      expect(mockWriteFile).toHaveBeenCalled();
      expect(url).toBe('/static/events/test-id/banner.jpg');
    });
  });
});
