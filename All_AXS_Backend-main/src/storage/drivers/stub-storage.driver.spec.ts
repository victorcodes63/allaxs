import { Test, TestingModule } from '@nestjs/testing';
import { StubStorage } from './stub-storage.driver';
import { NotImplementedException } from '@nestjs/common';

describe('StubStorage', () => {
  let driver: StubStorage;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [StubStorage],
    }).compile();

    driver = module.get<StubStorage>(StubStorage);
  });

  describe('initUpload', () => {
    it('should throw NotImplementedException', async () => {
      await expect(
        driver.initUpload({
          key: 'test/key',
          contentType: 'image/jpeg',
          contentLength: 1024,
        }),
      ).rejects.toThrow('File uploads are disabled');
    });
  });

  describe('finalizeUrl', () => {
    it('should return empty string', () => {
      const url = driver.finalizeUrl('test/key');
      expect(url).toBe('');
    });
  });
});
