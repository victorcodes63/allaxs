import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../src/users/entities/user.entity';
import { OrganizerProfile } from '../src/users/entities/organizer-profile.entity';
import { Event } from '../src/events/entities/event.entity';
import { TicketType } from '../src/events/entities/ticket-type.entity';
import { EventStatus, EventType, TicketTypeStatus } from '../src/domain/enums';
import { Role } from '../src/domain/enums';
import { setupTestAppWithUsers, destroyTestApp } from './utils/test-setup';
import { cleanDatabase } from './utils/seed';

describe('Ticket Types E2E', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let eventRepository: any;
  let ticketTypeRepository: any;
  let organizerProfileRepository: any;
  let organizerAccessToken: string;
  let attendeeAccessToken: string;
  let organizerProfileId: string;
  let eventId: string;

  beforeAll(async () => {
    const testApp = await setupTestAppWithUsers();
    app = testApp.app;
    dataSource = testApp.dataSource;
    organizerProfileId = testApp.seededUsers.organizer.profile.id;

    eventRepository = testApp.moduleFixture.get(getRepositoryToken(Event));
    ticketTypeRepository = testApp.moduleFixture.get(
      getRepositoryToken(TicketType),
    );
    organizerProfileRepository = testApp.moduleFixture.get(
      getRepositoryToken(OrganizerProfile),
    );

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

    // Create a test event
    const organizerProfile = await organizerProfileRepository.findOne({
      where: { id: organizerProfileId },
    });
    const event = eventRepository.create({
      organizer: organizerProfile,
      title: 'Test Event for Ticket Types',
      description: 'Test Description',
      type: EventType.IN_PERSON,
      venue: 'Test Venue',
      startAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      endAt: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000),
      status: EventStatus.DRAFT,
      slug: 'test-event-ticket-types',
    });
    const savedEvent = await eventRepository.save(event);
    eventId = savedEvent.id;
  }, 30000);

  afterAll(async () => {
    if (dataSource && dataSource.isInitialized) {
      await cleanDatabase(dataSource);
      await dataSource.destroy();
    }
    if (app) {
      await app.close();
    }
  }, 30000);

  describe('POST /events/:eventId/ticket-types - Create Ticket Type', () => {
    it('should create a ticket type as organizer (201)', async () => {
      const ticketTypeData = {
        name: 'General Admission',
        description: 'Standard ticket',
        priceCents: 5000, // 50.00 KES
        quantity: 100,
        maxPerOrder: 5,
      };

      const response = await request(app.getHttpServer())
        .post(`/events/${eventId}/ticket-types`)
        .set('Authorization', `Bearer ${organizerAccessToken}`)
        .send(ticketTypeData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe(ticketTypeData.name);
      expect(response.body.priceCents).toBe(ticketTypeData.priceCents);
      expect(response.body.quantityTotal).toBe(ticketTypeData.quantity);
      expect(response.body.maxPerOrder).toBe(ticketTypeData.maxPerOrder);
      expect(response.body.status).toBe(TicketTypeStatus.ACTIVE);
    });

    it('should set status to DISABLED when quantity is 0', async () => {
      const ticketTypeData = {
        name: 'Sold Out Tier',
        priceCents: 1000,
        quantity: 0,
      };

      const response = await request(app.getHttpServer())
        .post(`/events/${eventId}/ticket-types`)
        .set('Authorization', `Bearer ${organizerAccessToken}`)
        .send(ticketTypeData)
        .expect(201);

      expect(response.body.status).toBe(TicketTypeStatus.DISABLED);
    });

    it('should reject duplicate name within same event (409)', async () => {
      const ticketTypeData = {
        name: 'Duplicate Name',
        priceCents: 1000,
        quantity: 10,
      };

      // Create first ticket type
      await request(app.getHttpServer())
        .post(`/events/${eventId}/ticket-types`)
        .set('Authorization', `Bearer ${organizerAccessToken}`)
        .send(ticketTypeData)
        .expect(201);

      // Try to create duplicate
      await request(app.getHttpServer())
        .post(`/events/${eventId}/ticket-types`)
        .set('Authorization', `Bearer ${organizerAccessToken}`)
        .send(ticketTypeData)
        .expect(409);
    });

    it('should reject invalid price (400)', async () => {
      const ticketTypeData = {
        name: 'Invalid Price',
        priceCents: -100,
        quantity: 10,
      };

      await request(app.getHttpServer())
        .post(`/events/${eventId}/ticket-types`)
        .set('Authorization', `Bearer ${organizerAccessToken}`)
        .send(ticketTypeData)
        .expect(400);
    });

    it('should reject invalid quantity (400)', async () => {
      const ticketTypeData = {
        name: 'Invalid Quantity',
        priceCents: 1000,
        quantity: -1,
      };

      await request(app.getHttpServer())
        .post(`/events/${eventId}/ticket-types`)
        .set('Authorization', `Bearer ${organizerAccessToken}`)
        .send(ticketTypeData)
        .expect(400);
    });

    it('should reject price field instead of priceCents (400)', async () => {
      // This tests that ValidationPipe correctly rejects non-whitelisted fields
      const ticketTypeData = {
        name: 'Invalid Field Name',
        price: 1500, // Wrong field name - should be priceCents
        quantity: 100,
      };

      const response = await request(app.getHttpServer())
        .post(`/events/${eventId}/ticket-types`)
        .set('Authorization', `Bearer ${organizerAccessToken}`)
        .send(ticketTypeData)
        .expect(400);

      // Should get validation error about forbidden property or missing priceCents
      expect(response.body.message).toBeDefined();
    });

    it('should reject missing priceCents (400)', async () => {
      const ticketTypeData = {
        name: 'Missing Price',
        quantity: 100,
        // priceCents is missing
      };

      const response = await request(app.getHttpServer())
        .post(`/events/${eventId}/ticket-types`)
        .set('Authorization', `Bearer ${organizerAccessToken}`)
        .send(ticketTypeData)
        .expect(400);

      // Should get validation error about missing priceCents
      expect(response.body.message).toBeDefined();
    });

    it('should reject sales window outside event window (400)', async () => {
      const event = await eventRepository.findOne({ where: { id: eventId } });
      const ticketTypeData = {
        name: 'Invalid Sales Window',
        priceCents: 1000,
        quantity: 10,
        salesStartAt: new Date(
          event.startAt.getTime() - 24 * 60 * 60 * 1000,
        ).toISOString(), // Before event start
        salesEndAt: new Date(
          event.endAt.getTime() + 24 * 60 * 60 * 1000,
        ).toISOString(), // After event end
      };

      await request(app.getHttpServer())
        .post(`/events/${eventId}/ticket-types`)
        .set('Authorization', `Bearer ${organizerAccessToken}`)
        .send(ticketTypeData)
        .expect(400);
    });

    it('should reject non-owner (403)', async () => {
      // Create another event owned by different organizer
      const otherEvent = eventRepository.create({
        organizer: await organizerProfileRepository.findOne({
          where: { id: organizerProfileId },
        }),
        title: 'Other Event',
        type: EventType.VIRTUAL,
        startAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        endAt: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000),
        status: EventStatus.DRAFT,
        slug: 'other-event',
      });
      const savedOtherEvent = await eventRepository.save(otherEvent);

      const ticketTypeData = {
        name: 'Unauthorized',
        priceCents: 1000,
        quantity: 10,
      };

      // Try to create ticket type for other organizer's event
      await request(app.getHttpServer())
        .post(`/events/${savedOtherEvent.id}/ticket-types`)
        .set('Authorization', `Bearer ${attendeeAccessToken}`)
        .send(ticketTypeData)
        .expect(403);
    });

    it('should reject for published event (400)', async () => {
      // Update event to published
      await eventRepository.update(eventId, {
        status: EventStatus.PUBLISHED,
      });

      const ticketTypeData = {
        name: 'Cannot Create',
        priceCents: 1000,
        quantity: 10,
      };

      await request(app.getHttpServer())
        .post(`/events/${eventId}/ticket-types`)
        .set('Authorization', `Bearer ${organizerAccessToken}`)
        .send(ticketTypeData)
        .expect(400);

      // Reset to draft
      await eventRepository.update(eventId, {
        status: EventStatus.DRAFT,
      });
    });
  });

  describe('GET /events/:eventId/ticket-types - List Ticket Types', () => {
    let ticketTypeId: string;

    beforeEach(async () => {
      const ticketType = ticketTypeRepository.create({
        eventId,
        name: 'List Test Tier',
        priceCents: 2000,
        quantityTotal: 50,
        status: TicketTypeStatus.ACTIVE,
      });
      const saved = await ticketTypeRepository.save(ticketType);
      ticketTypeId = saved.id;
    });

    afterEach(async () => {
      await ticketTypeRepository.delete({ id: ticketTypeId });
    });

    it('should list ticket types for event (200)', async () => {
      const response = await request(app.getHttpServer())
        .get(`/events/${eventId}/ticket-types`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('should allow public access for published events', async () => {
      // Update event to published
      await eventRepository.update(eventId, {
        status: EventStatus.PUBLISHED,
      });

      const response = await request(app.getHttpServer())
        .get(`/events/${eventId}/ticket-types`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);

      // Reset to draft
      await eventRepository.update(eventId, {
        status: EventStatus.DRAFT,
      });
    });
  });

  describe('GET /ticket-types/:id - Get Ticket Type', () => {
    let ticketTypeId: string;

    beforeEach(async () => {
      const ticketType = ticketTypeRepository.create({
        eventId,
        name: 'Get Test Tier',
        priceCents: 3000,
        quantityTotal: 75,
        status: TicketTypeStatus.ACTIVE,
      });
      const saved = await ticketTypeRepository.save(ticketType);
      ticketTypeId = saved.id;
    });

    afterEach(async () => {
      await ticketTypeRepository.delete({ id: ticketTypeId });
    });

    it('should get ticket type by ID (200)', async () => {
      const response = await request(app.getHttpServer())
        .get(`/ticket-types/${ticketTypeId}`)
        .expect(200);

      expect(response.body.id).toBe(ticketTypeId);
      expect(response.body.name).toBe('Get Test Tier');
    });

    it('should return 404 for non-existent ticket type', async () => {
      await request(app.getHttpServer())
        .get('/ticket-types/00000000-0000-0000-0000-000000000000')
        .expect(404);
    });
  });

  describe('PATCH /ticket-types/:id - Update Ticket Type', () => {
    let ticketTypeId: string;

    beforeEach(async () => {
      const ticketType = ticketTypeRepository.create({
        eventId,
        name: 'Update Test Tier',
        priceCents: 4000,
        quantityTotal: 100,
        status: TicketTypeStatus.ACTIVE,
      });
      const saved = await ticketTypeRepository.save(ticketType);
      ticketTypeId = saved.id;
    });

    afterEach(async () => {
      await ticketTypeRepository.delete({ id: ticketTypeId });
    });

    it('should update ticket type (200)', async () => {
      const updateData = {
        name: 'Updated Name',
        priceCents: 5000,
      };

      const response = await request(app.getHttpServer())
        .patch(`/ticket-types/${ticketTypeId}`)
        .set('Authorization', `Bearer ${organizerAccessToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.name).toBe(updateData.name);
      expect(response.body.priceCents).toBe(updateData.priceCents);
    });

    it('should reject update for published event (400)', async () => {
      await eventRepository.update(eventId, {
        status: EventStatus.PUBLISHED,
      });

      const updateData = {
        name: 'Cannot Update',
      };

      await request(app.getHttpServer())
        .patch(`/ticket-types/${ticketTypeId}`)
        .set('Authorization', `Bearer ${organizerAccessToken}`)
        .send(updateData)
        .expect(400);

      // Reset to draft
      await eventRepository.update(eventId, {
        status: EventStatus.DRAFT,
      });
    });

    it('should reject update by non-owner (403)', async () => {
      const updateData = {
        name: 'Unauthorized Update',
      };

      await request(app.getHttpServer())
        .patch(`/ticket-types/${ticketTypeId}`)
        .set('Authorization', `Bearer ${attendeeAccessToken}`)
        .send(updateData)
        .expect(403);
    });
  });

  describe('DELETE /ticket-types/:id - Delete Ticket Type', () => {
    let ticketTypeId: string;

    beforeEach(async () => {
      const ticketType = ticketTypeRepository.create({
        eventId,
        name: 'Delete Test Tier',
        priceCents: 6000,
        quantityTotal: 120,
        status: TicketTypeStatus.ACTIVE,
      });
      const saved = await ticketTypeRepository.save(ticketType);
      ticketTypeId = saved.id;
    });

    it('should delete ticket type (204)', async () => {
      await request(app.getHttpServer())
        .delete(`/ticket-types/${ticketTypeId}`)
        .set('Authorization', `Bearer ${organizerAccessToken}`)
        .expect(204);

      // Verify deleted
      const deleted = await ticketTypeRepository.findOne({
        where: { id: ticketTypeId },
      });
      expect(deleted).toBeNull();
    });

    it('should reject delete for published event (400)', async () => {
      await eventRepository.update(eventId, {
        status: EventStatus.PUBLISHED,
      });

      await request(app.getHttpServer())
        .delete(`/ticket-types/${ticketTypeId}`)
        .set('Authorization', `Bearer ${organizerAccessToken}`)
        .expect(400);

      // Reset to draft
      await eventRepository.update(eventId, {
        status: EventStatus.DRAFT,
      });

      // Clean up
      await ticketTypeRepository.delete({ id: ticketTypeId });
    });

    it('should reject delete by non-owner (403)', async () => {
      await request(app.getHttpServer())
        .delete(`/ticket-types/${ticketTypeId}`)
        .set('Authorization', `Bearer ${attendeeAccessToken}`)
        .expect(403);

      // Clean up
      await ticketTypeRepository.delete({ id: ticketTypeId });
    });
  });
});
