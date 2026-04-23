import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../src/users/entities/user.entity';
import { OrganizerProfile } from '../src/users/entities/organizer-profile.entity';
import { Event } from '../src/events/entities/event.entity';
import { EventStatus, EventType } from '../src/domain/enums';
import { Role } from '../src/domain/enums';
import { setupTestAppWithUsers, destroyTestApp } from './utils/test-setup';
import { cleanDatabase } from './utils/seed';
import * as bcrypt from 'bcryptjs';

describe('Events E2E', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let userRepository: any;
  let organizerProfileRepository: any;
  let eventRepository: any;
  let adminAccessToken: string;
  let organizerAccessToken: string;
  let attendeeAccessToken: string;
  let organizerProfileId: string;

  beforeAll(async () => {
    // Setup test app with seeded users
    const testApp = await setupTestAppWithUsers();
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
    const adminLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: testApp.seededUsers.admin.user.email,
        password: 'Passw0rd!',
      });
    adminAccessToken = adminLogin.body.tokens.accessToken;

    const organizerLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: testApp.seededUsers.organizer.user.email,
        password: 'Passw0rd!',
      });
    organizerAccessToken = organizerLogin.body.tokens.accessToken;

    const attendeeLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: testApp.seededUsers.attendee.user.email,
        password: 'Passw0rd!',
      });
    attendeeAccessToken = attendeeLogin.body.tokens.accessToken;
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

  describe('POST /events - Create Event', () => {
    it('should create an event as organizer (201)', async () => {
      const eventData = {
        title: 'Test Event',
        description: 'Test Description',
        type: EventType.IN_PERSON,
        venue: 'Test Venue',
        startsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
        endsAt: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString(), // 8 days from now
      };

      const response = await request(app.getHttpServer())
        .post('/events')
        .set('Authorization', `Bearer ${organizerAccessToken}`)
        .send(eventData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.title).toBe(eventData.title);
      expect(response.body.status).toBe(EventStatus.DRAFT);
      expect(response.body.slug).toBeDefined();
      expect(response.body.organizerId).toBe(organizerProfileId);
    });

    it('should respect Idempotency-Key header', async () => {
      const idempotencyKey = 'test-idempotency-key-123';
      const eventData = {
        title: 'Idempotent Event',
        description: 'Test Description',
        type: EventType.VIRTUAL,
        startsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        endsAt: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString(),
      };

      // First request
      const response1 = await request(app.getHttpServer())
        .post('/events')
        .set('Authorization', `Bearer ${organizerAccessToken}`)
        .set('Idempotency-Key', idempotencyKey)
        .send(eventData)
        .expect(201);

      const eventId1 = response1.body.id;

      // Second request with same idempotency key
      const response2 = await request(app.getHttpServer())
        .post('/events')
        .set('Authorization', `Bearer ${organizerAccessToken}`)
        .set('Idempotency-Key', idempotencyKey)
        .send(eventData)
        .expect(201);

      // Should return the same event
      expect(response2.body.id).toBe(eventId1);
      expect(response2.body.title).toBe(eventData.title);
    });

    it('should reject creation without organizer profile (403)', async () => {
      // Create user without organizer profile
      const userPasswordHash = await bcrypt.hash('Passw0rd!', 10);
      const userWithoutProfile = userRepository.create({
        email: 'noorganizer@example.com',
        passwordHash: userPasswordHash,
        name: 'No Organizer',
        roles: [Role.ORGANIZER],
      });
      const savedUser = await userRepository.save(userWithoutProfile);

      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'noorganizer@example.com',
          password: 'Passw0rd!',
        });

      const token = loginResponse.body.tokens.accessToken;

      const eventData = {
        title: 'Test Event',
        type: EventType.VIRTUAL,
        startsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        endsAt: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString(),
      };

      await request(app.getHttpServer())
        .post('/events')
        .set('Authorization', `Bearer ${token}`)
        .send(eventData)
        .expect(403);

      // Cleanup
      await userRepository.delete({ id: savedUser.id });
    });

    it('should reject creation by attendee (403)', async () => {
      const eventData = {
        title: 'Test Event',
        type: EventType.VIRTUAL,
        startsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        endsAt: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString(),
      };

      await request(app.getHttpServer())
        .post('/events')
        .set('Authorization', `Bearer ${attendeeAccessToken}`)
        .send(eventData)
        .expect(403);
    });

    it('should reject creation without authentication (401)', async () => {
      const eventData = {
        title: 'Test Event',
        type: EventType.VIRTUAL,
        startsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        endsAt: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString(),
      };

      await request(app.getHttpServer())
        .post('/events')
        .send(eventData)
        .expect(401);
    });
  });

  describe('Validation - Create Event', () => {
    it('should reject event with endsAt <= startsAt (400)', async () => {
      const eventData = {
        title: 'Test Event',
        type: EventType.VIRTUAL,
        startsAt: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString(),
        endsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // Before startsAt
      };

      await request(app.getHttpServer())
        .post('/events')
        .set('Authorization', `Bearer ${organizerAccessToken}`)
        .send(eventData)
        .expect(400);
    });

    it('should reject in_person event without venue (400)', async () => {
      const eventData = {
        title: 'Test Event',
        type: EventType.IN_PERSON,
        // venue missing
        startsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        endsAt: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString(),
      };

      await request(app.getHttpServer())
        .post('/events')
        .set('Authorization', `Bearer ${organizerAccessToken}`)
        .send(eventData)
        .expect(400);
    });

    it('should reject hybrid event without venue (400)', async () => {
      const eventData = {
        title: 'Test Event',
        type: EventType.HYBRID,
        // venue missing
        startsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        endsAt: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString(),
      };

      await request(app.getHttpServer())
        .post('/events')
        .set('Authorization', `Bearer ${organizerAccessToken}`)
        .send(eventData)
        .expect(400);
    });

    it('should allow virtual event without venue (201)', async () => {
      const eventData = {
        title: 'Virtual Event',
        type: EventType.VIRTUAL,
        startsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        endsAt: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString(),
      };

      await request(app.getHttpServer())
        .post('/events')
        .set('Authorization', `Bearer ${organizerAccessToken}`)
        .send(eventData)
        .expect(201);
    });
  });

  describe('GET /events/:id - Get Event', () => {
    let publishedEventId: string;
    let draftEventId: string;
    let organizerProfile: OrganizerProfile;

    beforeAll(async () => {
      if (!organizerProfileRepository || !eventRepository) {
        throw new Error('Repositories are not initialized');
      }
      // Load organizer profile for relation
      organizerProfile = await organizerProfileRepository.findOne({
        where: { id: organizerProfileId },
      });
      if (!organizerProfile) {
        throw new Error('Organizer profile not found');
      }

      // Create a published event
      const publishedEvent = eventRepository.create({
        organizer: organizerProfile,
        title: 'Published Event',
        description: 'Published Description',
        type: EventType.VIRTUAL,
        startAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        endAt: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000),
        status: EventStatus.PUBLISHED,
        slug: 'published-event',
      });
      const savedPublished = await eventRepository.save(publishedEvent);
      publishedEventId = savedPublished.id;

      // Create a draft event
      const draftEvent = eventRepository.create({
        organizer: organizerProfile,
        title: 'Draft Event',
        description: 'Draft Description',
        type: EventType.VIRTUAL,
        startAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        endAt: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000),
        status: EventStatus.DRAFT,
        slug: 'draft-event',
      });
      const savedDraft = await eventRepository.save(draftEvent);
      draftEventId = savedDraft.id;
    }, 30000);

    it('should allow public access to published event (200)', async () => {
      const response = await request(app.getHttpServer())
        .get(`/events/${publishedEventId}`)
        .expect(200);

      expect(response.body.id).toBe(publishedEventId);
      expect(response.body.status).toBe(EventStatus.PUBLISHED);
    });

    it('should reject public access to draft event (404)', async () => {
      await request(app.getHttpServer())
        .get(`/events/${draftEventId}`)
        .expect(404);
    });

    it('should allow organizer to access their draft event (200)', async () => {
      const response = await request(app.getHttpServer())
        .get(`/events/${draftEventId}`)
        .set('Authorization', `Bearer ${organizerAccessToken}`)
        .expect(200);

      expect(response.body.id).toBe(draftEventId);
      expect(response.body.status).toBe(EventStatus.DRAFT);
    });

    it('should allow admin to access draft event (200)', async () => {
      const response = await request(app.getHttpServer())
        .get(`/events/${draftEventId}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(response.body.id).toBe(draftEventId);
    });

    it('should reject attendee access to draft event (404)', async () => {
      await request(app.getHttpServer())
        .get(`/events/${draftEventId}`)
        .set('Authorization', `Bearer ${attendeeAccessToken}`)
        .expect(404);
    });
  });

  describe('PATCH /events/:id - Update Event', () => {
    let eventId: string;
    let organizerProfile: OrganizerProfile;

    beforeEach(async () => {
      if (!organizerProfileRepository || !eventRepository) {
        throw new Error('Repositories are not initialized');
      }
      // Load organizer profile for relation
      organizerProfile = await organizerProfileRepository.findOne({
        where: { id: organizerProfileId },
      });
      if (!organizerProfile) {
        throw new Error('Organizer profile not found');
      }

      // Create a draft event for testing
      const event = eventRepository.create({
        organizer: organizerProfile,
        title: 'Event to Update',
        description: 'Original Description',
        type: EventType.VIRTUAL,
        startAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        endAt: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000),
        status: EventStatus.DRAFT,
        slug: 'event-to-update',
      });
      const saved = await eventRepository.save(event);
      eventId = saved.id;
    });

    afterEach(async () => {
      if (eventRepository && eventId) {
        await eventRepository.delete({ id: eventId });
      }
    });

    it('should update event as owner (200)', async () => {
      const updateData = {
        title: 'Updated Event Title',
        description: 'Updated Description',
      };

      const response = await request(app.getHttpServer())
        .patch(`/events/${eventId}`)
        .set('Authorization', `Bearer ${organizerAccessToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.title).toBe(updateData.title);
      expect(response.body.description).toBe(updateData.description);
      expect(response.body.slug).toBeDefined();
    });

    it('should reject update by non-owner (403)', async () => {
      // Create another organizer
      const otherOrganizerPasswordHash = await bcrypt.hash('Passw0rd!', 10);
      const otherOrganizer = userRepository.create({
        email: 'otherorg@example.com',
        passwordHash: otherOrganizerPasswordHash,
        name: 'Other Organizer',
        roles: [Role.ORGANIZER],
      });
      const savedOtherOrganizer = await userRepository.save(otherOrganizer);

      const otherProfile = organizerProfileRepository.create({
        userId: savedOtherOrganizer.id,
        orgName: 'Other Org',
        supportEmail: 'support@other.org',
      });
      await organizerProfileRepository.save(otherProfile);

      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'otherorg@example.com',
          password: 'Passw0rd!',
        });

      const otherToken = loginResponse.body.tokens.accessToken;

      await request(app.getHttpServer())
        .patch(`/events/${eventId}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ title: 'Hacked Title' })
        .expect(403);

      // Cleanup
      await organizerProfileRepository.delete({
        userId: savedOtherOrganizer.id,
      });
      await userRepository.delete({ id: savedOtherOrganizer.id });
    });

    it('should reject update when status is published (400)', async () => {
      // Update event to published
      await eventRepository.update(eventId, { status: EventStatus.PUBLISHED });

      await request(app.getHttpServer())
        .patch(`/events/${eventId}`)
        .set('Authorization', `Bearer ${organizerAccessToken}`)
        .send({ title: 'Updated Title' })
        .expect(400);

      // Revert to draft for cleanup
      await eventRepository.update(eventId, { status: EventStatus.DRAFT });
    });
  });

  describe('POST /events/:id/submit - Submit for Review', () => {
    let eventId: string;
    let organizerProfile: OrganizerProfile;

    beforeEach(async () => {
      if (!organizerProfileRepository || !eventRepository) {
        throw new Error('Repositories are not initialized');
      }
      // Load organizer profile for relation
      organizerProfile = await organizerProfileRepository.findOne({
        where: { id: organizerProfileId },
      });
      if (!organizerProfile) {
        throw new Error('Organizer profile not found');
      }

      const event = eventRepository.create({
        organizer: organizerProfile,
        title: 'Event to Submit',
        description: 'Test Description',
        type: EventType.IN_PERSON,
        venue: 'Test Venue',
        startAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        endAt: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000),
        status: EventStatus.DRAFT,
        slug: 'event-to-submit',
      });
      const saved = await eventRepository.save(event);
      eventId = saved.id;
    });

    afterEach(async () => {
      if (eventRepository && eventId) {
        await eventRepository.delete({ id: eventId });
      }
    });

    it('should submit event from draft to pending (200)', async () => {
      const response = await request(app.getHttpServer())
        .post(`/events/${eventId}/submit`)
        .set('Authorization', `Bearer ${organizerAccessToken}`)
        .expect(200);

      expect(response.body.status).toBe(EventStatus.PENDING_REVIEW);
    });

    it('should reject submit from non-draft status (400)', async () => {
      if (!eventRepository) {
        throw new Error('eventRepository is not initialized');
      }
      // Update to pending
      await eventRepository.update(eventId, {
        status: EventStatus.PENDING_REVIEW,
      });

      await request(app.getHttpServer())
        .post(`/events/${eventId}/submit`)
        .set('Authorization', `Bearer ${organizerAccessToken}`)
        .expect(400);
    });

    it('should reject submit without required fields (400)', async () => {
      if (!organizerProfileRepository || !eventRepository) {
        throw new Error('Repositories are not initialized');
      }
      // Load organizer profile for relation
      const organizerProfile = await organizerProfileRepository.findOne({
        where: { id: organizerProfileId },
      });
      if (!organizerProfile) {
        throw new Error('Organizer profile not found');
      }

      // Create event without venue (required for IN_PERSON)
      const eventWithoutVenue = eventRepository.create({
        organizer: organizerProfile,
        title: 'Event Without Venue',
        type: EventType.IN_PERSON,
        // venue missing
        startAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        endAt: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000),
        status: EventStatus.DRAFT,
        slug: 'event-without-venue',
      });
      const saved = await eventRepository.save(eventWithoutVenue);

      await request(app.getHttpServer())
        .post(`/events/${saved.id}/submit`)
        .set('Authorization', `Bearer ${organizerAccessToken}`)
        .expect(400);

      await eventRepository.delete({ id: saved.id });
    });
  });

  describe('POST /admin/events/:id/approve - Approve Event', () => {
    let eventId: string;
    let organizerProfile: OrganizerProfile;

    beforeEach(async () => {
      if (!organizerProfileRepository || !eventRepository) {
        throw new Error('Repositories are not initialized');
      }
      // Load organizer profile for relation
      organizerProfile = await organizerProfileRepository.findOne({
        where: { id: organizerProfileId },
      });
      if (!organizerProfile) {
        throw new Error('Organizer profile not found');
      }

      const event = eventRepository.create({
        organizer: organizerProfile,
        title: 'Event to Approve',
        description: 'Test Description',
        type: EventType.VIRTUAL,
        startAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        endAt: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000),
        status: EventStatus.PENDING_REVIEW,
        slug: 'event-to-approve',
      });
      const saved = await eventRepository.save(event);
      eventId = saved.id;
    });

    afterEach(async () => {
      if (eventRepository && eventId) {
        await eventRepository.delete({ id: eventId });
      }
    });

    it('should approve event from pending to published (200)', async () => {
      const response = await request(app.getHttpServer())
        .post(`/admin/events/${eventId}/approve`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(response.body.event.status).toBe(EventStatus.PUBLISHED);
      expect(response.body.event.previousStatus).toBe(
        EventStatus.PENDING_REVIEW,
      );
    });

    it('should reject approve from non-pending status (400)', async () => {
      if (!eventRepository) {
        throw new Error('eventRepository is not initialized');
      }
      // Update to draft
      await eventRepository.update(eventId, { status: EventStatus.DRAFT });

      await request(app.getHttpServer())
        .post(`/admin/events/${eventId}/approve`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(400);
    });

    it('should reject approve by non-admin (403)', async () => {
      await request(app.getHttpServer())
        .post(`/admin/events/${eventId}/approve`)
        .set('Authorization', `Bearer ${organizerAccessToken}`)
        .expect(403);
    });
  });

  describe('POST /admin/events/:id/reject - Reject Event', () => {
    let eventId: string;
    let organizerProfile: OrganizerProfile;

    beforeEach(async () => {
      if (!organizerProfileRepository || !eventRepository) {
        throw new Error('Repositories are not initialized');
      }
      // Load organizer profile for relation
      organizerProfile = await organizerProfileRepository.findOne({
        where: { id: organizerProfileId },
      });
      if (!organizerProfile) {
        throw new Error('Organizer profile not found');
      }

      const event = eventRepository.create({
        organizer: organizerProfile,
        title: 'Event to Reject',
        description: 'Test Description',
        type: EventType.VIRTUAL,
        startAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        endAt: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000),
        status: EventStatus.PENDING_REVIEW,
        slug: 'event-to-reject',
      });
      const saved = await eventRepository.save(event);
      eventId = saved.id;
    });

    afterEach(async () => {
      if (eventRepository && eventId) {
        await eventRepository.delete({ id: eventId });
      }
    });

    it('should reject event from pending to rejected (200)', async () => {
      const rejectReason = 'Event does not meet our guidelines';

      const response = await request(app.getHttpServer())
        .post(`/admin/events/${eventId}/reject`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({ reason: rejectReason })
        .expect(200);

      expect(response.body.event.status).toBe(EventStatus.REJECTED);
      expect(response.body.event.rejectionReason).toBe(rejectReason);

      // Verify reason is stored in metadata
      if (!eventRepository) {
        throw new Error('eventRepository is not initialized');
      }
      const event = await eventRepository.findOne({ where: { id: eventId } });
      expect(event?.metadata?.rejectionReason).toBe(rejectReason);
    });

    it('should reject event without reason (200)', async () => {
      const response = await request(app.getHttpServer())
        .post(`/admin/events/${eventId}/reject`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({})
        .expect(200);

      expect(response.body.event.status).toBe(EventStatus.REJECTED);
    });

    it('should reject reject from non-pending status (400)', async () => {
      if (!eventRepository) {
        throw new Error('eventRepository is not initialized');
      }
      // Update to draft
      await eventRepository.update(eventId, { status: EventStatus.DRAFT });

      await request(app.getHttpServer())
        .post(`/admin/events/${eventId}/reject`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({ reason: 'Test' })
        .expect(400);
    });

    it('should reject reject by non-admin (403)', async () => {
      await request(app.getHttpServer())
        .post(`/admin/events/${eventId}/reject`)
        .set('Authorization', `Bearer ${organizerAccessToken}`)
        .send({ reason: 'Test' })
        .expect(403);
    });
  });
});
