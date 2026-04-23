import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../src/users/entities/user.entity';
import { OrganizerProfile } from '../src/users/entities/organizer-profile.entity';
import { Event } from '../src/events/entities/event.entity';
import { EventStatus, EventType } from '../src/domain/enums';
import { setupTestAppWithUsers, destroyTestApp } from './utils/test-setup';
import { cleanDatabase } from './utils/seed';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('Events Banner Upload E2E', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let userRepository: any;
  let organizerProfileRepository: any;
  let eventRepository: any;
  let organizerAccessToken: string;
  let organizer2AccessToken: string;
  let organizerProfileId: string;
  let eventId: string;
  let eventId2: string;

  beforeAll(async () => {
    // Setup test app with seeded users (including organizer2)
    const testApp = await setupTestAppWithUsers({ includeOrganizer2: true });
    app = testApp.app;
    dataSource = testApp.dataSource;
    organizerProfileId = testApp.seededUsers.organizer.profile.id;

    // Get repositories
    userRepository = testApp.moduleFixture.get(getRepositoryToken(User));
    organizerProfileRepository = testApp.moduleFixture.get(
      getRepositoryToken(OrganizerProfile),
    );
    eventRepository = testApp.moduleFixture.get(getRepositoryToken(Event));

    // Login and get access tokens
    const organizerLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: testApp.seededUsers.organizer.user.email,
        password: 'Passw0rd!',
      });
    organizerAccessToken = organizerLogin.body.tokens.accessToken;

    const organizer2Login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: testApp.seededUsers.organizer2!.user.email,
        password: 'Passw0rd!',
      });
    organizer2AccessToken = organizer2Login.body.tokens.accessToken;

    // Create test events
    const organizerProfile = await organizerProfileRepository.findOne({
      where: { id: organizerProfileId },
    });
    if (!organizerProfile) {
      throw new Error('Organizer profile not found');
    }

    const event = eventRepository.create({
      organizer: organizerProfile,
      title: 'Test Event',
      slug: 'test-event',
      type: EventType.IN_PERSON,
      venue: 'Test Venue',
      startAt: new Date(Date.now() + 86400000), // Tomorrow
      endAt: new Date(Date.now() + 172800000), // Day after tomorrow
      status: EventStatus.DRAFT,
    });
    const savedEvent = await eventRepository.save(event);
    eventId = savedEvent.id;

    const event2 = eventRepository.create({
      organizer: organizerProfile,
      title: 'Test Event 2',
      slug: 'test-event-2',
      type: EventType.VIRTUAL,
      startAt: new Date(Date.now() + 86400000),
      endAt: new Date(Date.now() + 172800000),
      status: EventStatus.PUBLISHED, // Cannot edit
    });
    const savedEvent2 = await eventRepository.save(event2);
    eventId2 = savedEvent2.id;
  }, 30000);

  afterAll(async () => {
    // Clean up uploaded files
    try {
      const uploadsDir = path.join(process.cwd(), 'uploads');
      await fs.rm(uploadsDir, { recursive: true, force: true });
    } catch {
      // Ignore errors
    }

    // Clean database and close app
    if (dataSource && dataSource.isInitialized) {
      await cleanDatabase(dataSource);
      await dataSource.destroy();
    }
    if (app) {
      await app.close();
    }
  }, 30000);

  describe('POST /uploads/events/:eventId/banner/init', () => {
    it('should initialize banner upload for draft event (local storage)', async () => {
      const response = await request(app.getHttpServer())
        .post(`/uploads/events/${eventId}/banner/init`)
        .set('Authorization', `Bearer ${organizerAccessToken}`)
        .send({
          mime: 'image/png',
          size: 1024000, // 1MB
        })
        .expect(200);

      expect(response.body).toHaveProperty('mode', 'direct');
      expect(response.body).toHaveProperty('directUpload', true);
      expect(response.body).toHaveProperty('finalPathHint');
      expect(response.body.finalPathHint).toContain('events/');
      expect(response.body.finalPathHint).toContain('/banner.');
      expect(response.body).toHaveProperty('eventId', eventId);
      expect(response.body).toHaveProperty('key');
    });

    it('should initialize banner upload for pending review event', async () => {
      // Update event to PENDING_REVIEW
      const event = await eventRepository.findOne({ where: { id: eventId } });
      event.status = EventStatus.PENDING_REVIEW;
      await eventRepository.save(event);

      const response = await request(app.getHttpServer())
        .post(`/uploads/events/${eventId}/banner/init`)
        .set('Authorization', `Bearer ${organizerAccessToken}`)
        .send({
          mime: 'image/jpeg',
          size: 512000, // 500KB
        })
        .expect(200);

      expect(response.body).toHaveProperty('mode', 'direct');
      expect(response.body).toHaveProperty('directUpload', true);

      // Reset to DRAFT
      event.status = EventStatus.DRAFT;
      await eventRepository.save(event);
    });

    it('should reject upload for non-owner', async () => {
      await request(app.getHttpServer())
        .post(`/uploads/events/${eventId}/banner/init`)
        .set('Authorization', `Bearer ${organizer2AccessToken}`)
        .send({
          mime: 'image/png',
          size: 1024000,
        })
        .expect(403);
    });

    it('should reject upload for published event', async () => {
      await request(app.getHttpServer())
        .post(`/uploads/events/${eventId2}/banner/init`)
        .set('Authorization', `Bearer ${organizerAccessToken}`)
        .send({
          mime: 'image/png',
          size: 1024000,
        })
        .expect(403);
    });

    it('should reject disallowed MIME type', async () => {
      await request(app.getHttpServer())
        .post(`/uploads/events/${eventId}/banner/init`)
        .set('Authorization', `Bearer ${organizerAccessToken}`)
        .send({
          mime: 'application/pdf',
          size: 1024000,
        })
        .expect(400);
    });

    it('should reject file exceeding max size', async () => {
      await request(app.getHttpServer())
        .post(`/uploads/events/${eventId}/banner/init`)
        .set('Authorization', `Bearer ${organizerAccessToken}`)
        .send({
          mime: 'image/png',
          size: 50 * 1024 * 1024 + 1, // Exceeds 50MB
        })
        .expect(400);
    });

    it('should require authentication', async () => {
      await request(app.getHttpServer())
        .post(`/uploads/events/${eventId}/banner/init`)
        .send({
          mime: 'image/png',
          size: 1024000,
        })
        .expect(401);
    });
  });

  describe('POST /uploads/events/:eventId/banner/direct', () => {
    it('should upload banner directly (local storage)', async () => {
      // Create a test image buffer
      const testImage = Buffer.from('fake-image-data');

      const response = await request(app.getHttpServer())
        .post(`/uploads/events/${eventId}/banner/direct`)
        .set('Authorization', `Bearer ${organizerAccessToken}`)
        .attach('file', testImage, 'banner.png')
        .expect(200);

      expect(response.body).toHaveProperty('finalUrl');
      expect(response.body.finalUrl).toContain('/static/events/');
      expect(response.body.finalUrl).toContain('/banner.');
      expect(response.body).toHaveProperty('event');

      // Verify event has bannerUrl set
      const event = await eventRepository.findOne({ where: { id: eventId } });
      expect(event.bannerUrl).toBe(response.body.finalUrl);
    });

    it('should reject direct upload for non-owner', async () => {
      const testImage = Buffer.from('fake-image-data');

      await request(app.getHttpServer())
        .post(`/uploads/events/${eventId}/banner/direct`)
        .set('Authorization', `Bearer ${organizer2AccessToken}`)
        .attach('file', testImage, 'banner.png')
        .expect(403);
    });

    it('should reject direct upload for published event', async () => {
      const testImage = Buffer.from('fake-image-data');

      await request(app.getHttpServer())
        .post(`/uploads/events/${eventId2}/banner/direct`)
        .set('Authorization', `Bearer ${organizerAccessToken}`)
        .attach('file', testImage, 'banner.png')
        .expect(403);
    });
  });

  describe('POST /events/:id/banner/commit', () => {
    it('should commit banner URL to event', async () => {
      const bannerUrl = `/static/events/${eventId}/banner.jpg`;

      const response = await request(app.getHttpServer())
        .post(`/events/${eventId}/banner/commit`)
        .set('Authorization', `Bearer ${organizerAccessToken}`)
        .send({ url: bannerUrl })
        .expect(200);

      expect(response.body).toHaveProperty('bannerUrl', bannerUrl);
      expect(response.body).toHaveProperty('id', eventId);

      // Verify in database
      const event = await eventRepository.findOne({ where: { id: eventId } });
      expect(event.bannerUrl).toBe(bannerUrl);
    });

    it('should reject commit for non-owner', async () => {
      const bannerUrl = `/static/events/${eventId}/banner.jpg`;

      await request(app.getHttpServer())
        .post(`/events/${eventId}/banner/commit`)
        .set('Authorization', `Bearer ${organizer2AccessToken}`)
        .send({ url: bannerUrl })
        .expect(403);
    });

    it('should reject commit for published event', async () => {
      const bannerUrl = `/static/events/${eventId2}/banner.jpg`;

      await request(app.getHttpServer())
        .post(`/events/${eventId2}/banner/commit`)
        .set('Authorization', `Bearer ${organizerAccessToken}`)
        .send({ url: bannerUrl })
        .expect(400);
    });

    it('should reject URL with wrong event ID', async () => {
      const bannerUrl = `/static/events/wrong-id/banner.jpg`;

      await request(app.getHttpServer())
        .post(`/events/${eventId}/banner/commit`)
        .set('Authorization', `Bearer ${organizerAccessToken}`)
        .send({ url: bannerUrl })
        .expect(400);
    });

    it('should reject URL that does not match pattern', async () => {
      const bannerUrl = 'https://example.com/images/banner.jpg';

      await request(app.getHttpServer())
        .post(`/events/${eventId}/banner/commit`)
        .set('Authorization', `Bearer ${organizerAccessToken}`)
        .send({ url: bannerUrl })
        .expect(400);
    });

    it('should accept absolute URL with correct pattern', async () => {
      const bannerUrl = `https://cdn.example.com/events/${eventId}/banner.png`;

      const response = await request(app.getHttpServer())
        .post(`/events/${eventId}/banner/commit`)
        .set('Authorization', `Bearer ${organizerAccessToken}`)
        .send({ url: bannerUrl })
        .expect(200);

      expect(response.body).toHaveProperty('bannerUrl', bannerUrl);
    });
  });

  describe('GET /events/:id (with banner)', () => {
    it('should return event with bannerUrl', async () => {
      // Set a banner URL first
      const event = await eventRepository.findOne({ where: { id: eventId } });
      event.bannerUrl = `/static/events/${eventId}/banner.jpg`;
      await eventRepository.save(event);

      const response = await request(app.getHttpServer())
        .get(`/events/${eventId}`)
        .set('Authorization', `Bearer ${organizerAccessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty(
        'bannerUrl',
        `/static/events/${eventId}/banner.jpg`,
      );
    });
  });
});
