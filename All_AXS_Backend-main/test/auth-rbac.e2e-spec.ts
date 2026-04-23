import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../src/users/entities/user.entity';
import { RefreshToken } from '../src/auth/entities/refresh-token.entity';
import { AdminAuditLog } from '../src/admin/entities/admin-audit-log.entity';
import { Role } from '../src/domain/enums';
import { setupTestAppWithUsers, destroyTestApp } from './utils/test-setup';
import { cleanDatabase } from './utils/seed';
import * as bcrypt from 'bcryptjs';

describe('Auth & RBAC E2E', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let userRepository: any;
  let refreshTokenRepository: any;
  let adminAuditLogRepository: any;

  beforeAll(async () => {
    // Setup test app with seeded users
    const testApp = await setupTestAppWithUsers();
    app = testApp.app;
    dataSource = testApp.dataSource;

    // Get repositories
    userRepository = testApp.moduleFixture.get(getRepositoryToken(User));
    refreshTokenRepository = testApp.moduleFixture.get(
      getRepositoryToken(RefreshToken),
    );
    adminAuditLogRepository = testApp.moduleFixture.get(
      getRepositoryToken(AdminAuditLog),
    );
  }, 30000);

  afterAll(async () => {
    // Clean database and close app
    if (dataSource && dataSource.isInitialized) {
      await cleanDatabase(dataSource);
      await dataSource.destroy();
    }
    if (app) {
      await app.close();
    }
  }, 30000);

  describe('Auth Flow', () => {
    it('should register a new user', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'newuser@example.com',
          password: 'Passw0rd!',
          name: 'New User',
        })
        .expect(201);

      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe('newuser@example.com');
      expect(response.body).toHaveProperty('tokens');
      expect(response.body.tokens).toHaveProperty('accessToken');
      expect(response.body.tokens).toHaveProperty('refreshToken');
    });

    it('should login with valid credentials', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'admin@example.com',
          password: 'Passw0rd!',
        })
        .expect(200);

      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('tokens');
      expect(response.body.tokens).toHaveProperty('accessToken');
      expect(response.body.tokens).toHaveProperty('refreshToken');
    });

    it('should get current user with valid token', async () => {
      // Login first
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'admin@example.com',
          password: 'Passw0rd!',
        });

      const accessToken = loginResponse.body.tokens.accessToken;

      // Get me
      const meResponse = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(meResponse.body.user.email).toBe('admin@example.com');
    });

    it('should reject invalid credentials', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'admin@example.com',
          password: 'WrongPassword123!',
        })
        .expect(401);
    });
  });

  describe('Refresh Token Rotation', () => {
    let initialRefreshToken: string;
    let userId: string;

    beforeEach(async () => {
      // Create a test user and login
      const passwordHash = await bcrypt.hash('Passw0rd!', 10);
      const user = userRepository.create({
        email: 'refreshtest@example.com',
        passwordHash,
        name: 'Refresh Test User',
        roles: [Role.ORGANIZER],
      });
      const savedUser = await userRepository.save(user);
      userId = savedUser.id;

      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'refreshtest@example.com',
          password: 'Passw0rd!',
        });

      initialRefreshToken = loginResponse.body.tokens.refreshToken;
    });

    afterEach(async () => {
      // Clean up refresh tokens
      await refreshTokenRepository.delete({ userId });
      await userRepository.delete({ id: userId });
    });

    it('should refresh access token with valid refresh token', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({
          refreshToken: initialRefreshToken,
        })
        .expect(200);

      expect(response.body).toHaveProperty('tokens');
      expect(response.body.tokens).toHaveProperty('accessToken');
      expect(response.body.tokens).toHaveProperty('refreshToken');
      expect(response.body.tokens.refreshToken).not.toBe(initialRefreshToken);
    });

    it('should reject invalid refresh token', async () => {
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({
          refreshToken: 'invalid-token',
        })
        .expect(401);
    });
  });

  describe('RBAC - Role-Based Access Control', () => {
    it('should allow admin to access admin endpoint', async () => {
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'admin@example.com',
          password: 'Passw0rd!',
        });

      const accessToken = loginResponse.body.tokens.accessToken;

      const response = await request(app.getHttpServer())
        .get('/admin/ping')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.message).toBe('Admin endpoint is accessible');
    });

    it('should reject organizer from admin endpoint', async () => {
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'org@example.com',
          password: 'Passw0rd!',
        });

      const accessToken = loginResponse.body.tokens.accessToken;

      await request(app.getHttpServer())
        .get('/admin/ping')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(403);
    });

    it('should reject attendee from admin endpoint', async () => {
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'attendee@example.com',
          password: 'Passw0rd!',
        });

      const accessToken = loginResponse.body.tokens.accessToken;

      await request(app.getHttpServer())
        .get('/admin/ping')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(403);
    });

    it('should create audit log entry for admin action', async () => {
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'admin@example.com',
          password: 'Passw0rd!',
        });

      const accessToken = loginResponse.body.tokens.accessToken;

      await request(app.getHttpServer())
        .get('/admin/ping')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Verify audit log was created
      const auditLogs = await adminAuditLogRepository.find({
        where: { action: 'ADMIN_PING' },
      });
      expect(auditLogs.length).toBeGreaterThan(0);
    });
  });
});
