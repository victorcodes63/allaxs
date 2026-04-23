/**
 * @typedef {import('typeorm').MigrationInterface} MigrationInterface
 * @typedef {import('typeorm').QueryRunner} QueryRunner
 */

/**
 * @class
 * @implements {MigrationInterface}
 */
module.exports = class InitAllAxsERD1762409984453 {
    name = 'InitAllAxsERD1762409984453'

    /**
     * @param {QueryRunner} queryRunner
     */
    async up(queryRunner) {
        await queryRunner.query(`CREATE TABLE "webhook_events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "source" character varying(64) NOT NULL, "externalId" character varying(180) NOT NULL, "idempotencyKey" character varying(180) NOT NULL, "payload" jsonb NOT NULL, "processedAt" TIMESTAMP WITH TIME ZONE, "attempts" integer NOT NULL DEFAULT '0', "lastError" text, CONSTRAINT "UQ_9d614a1c2586d36302bf341597b" UNIQUE ("idempotencyKey"), CONSTRAINT "PK_4cba37e6a0acb5e1fc49c34ebfd" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_860377b8e653e308a6e36db575" ON "webhook_events" ("externalId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_9d614a1c2586d36302bf341597" ON "webhook_events" ("idempotencyKey") `);
        await queryRunner.query(`CREATE TYPE "public"."coupons_kind_enum" AS ENUM('FIXED', 'PERCENT')`);
        await queryRunner.query(`CREATE TABLE "coupons" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "code" character varying(64) NOT NULL, "kind" "public"."coupons_kind_enum" NOT NULL, "valueCents" integer, "percentOff" integer, "startAt" TIMESTAMP WITH TIME ZONE, "endAt" TIMESTAMP WITH TIME ZONE, "usageLimit" integer, "usedCount" integer NOT NULL DEFAULT '0', "perUserLimit" integer, "eventId" uuid, "active" boolean NOT NULL DEFAULT true, "event_id" uuid, CONSTRAINT "UQ_e025109230e82925843f2a14c48" UNIQUE ("code"), CONSTRAINT "PK_d7ea8864a0150183770f3e9a8cb" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_e025109230e82925843f2a14c4" ON "coupons" ("code") `);
        await queryRunner.query(`CREATE INDEX "IDX_1333c687be50e828f38e8c192c" ON "coupons" ("eventId") `);
        await queryRunner.query(`CREATE TABLE "ticket_types" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "eventId" uuid NOT NULL, "name" character varying(120) NOT NULL, "priceCents" integer NOT NULL, "currency" character(3) NOT NULL DEFAULT 'KES', "quantityTotal" integer NOT NULL, "quantitySold" integer NOT NULL DEFAULT '0', "minPerOrder" integer NOT NULL DEFAULT '1', "maxPerOrder" integer, "salesStart" TIMESTAMP WITH TIME ZONE, "salesEnd" TIMESTAMP WITH TIME ZONE, "event_id" uuid, CONSTRAINT "PK_5510ce7e18a4edc648c9fbfc283" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_0bf6c025aea56d71d7c0a019f9" ON "ticket_types" ("eventId") `);
        await queryRunner.query(`CREATE TYPE "public"."events_type_enum" AS ENUM('IN_PERSON', 'VIRTUAL', 'HYBRID')`);
        await queryRunner.query(`CREATE TYPE "public"."events_status_enum" AS ENUM('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'PUBLISHED', 'REJECTED', 'ARCHIVED')`);
        await queryRunner.query(`CREATE TABLE "events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "organizerId" uuid NOT NULL, "title" character varying(255) NOT NULL, "description" text NOT NULL, "bannerUrl" text, "venue" character varying(255), "city" character varying(120), "country" character varying(120), "startAt" TIMESTAMP WITH TIME ZONE NOT NULL, "endAt" TIMESTAMP WITH TIME ZONE NOT NULL, "type" "public"."events_type_enum" NOT NULL, "status" "public"."events_status_enum" NOT NULL DEFAULT 'DRAFT', "category" character varying(120), "isPublic" boolean NOT NULL DEFAULT true, "organizer_id" uuid, CONSTRAINT "PK_40731c7151fe4be3116e45ddf73" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_1024d476207981d1c72232cf3c" ON "events" ("organizerId") `);
        await queryRunner.query(`CREATE INDEX "IDX_7832b74193ded0a67048b5d598" ON "events" ("city") `);
        await queryRunner.query(`CREATE INDEX "IDX_dad02f90491c8dfe2610d05f8d" ON "events" ("startAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_03dcebc1ab44daa177ae9479c4" ON "events" ("status") `);
        await queryRunner.query(`CREATE TABLE "organizer_profiles" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "userId" uuid NOT NULL, "orgName" character varying(255) NOT NULL, "payoutDetails" jsonb, "verified" boolean NOT NULL DEFAULT false, "user_id" uuid, CONSTRAINT "UQ_ffd03e2338254f8358702eceabb" UNIQUE ("userId"), CONSTRAINT "REL_ea845db509307bc33365054eac" UNIQUE ("user_id"), CONSTRAINT "PK_8e09aa532f012ff2298b819c04a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_ffd03e2338254f8358702eceab" ON "organizer_profiles" ("userId") `);
        await queryRunner.query(`CREATE TABLE "checkins" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "ticketId" uuid NOT NULL, "operatorId" uuid, "gateId" character varying(64), "deviceId" character varying(64), "occurredAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "ticket_id" uuid, "operator_id" uuid, CONSTRAINT "PK_99c62633386398b154840f0708c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_23a4509421eb1240d870717aff" ON "checkins" ("ticketId") `);
        await queryRunner.query(`CREATE INDEX "IDX_a76f535abddc02ce2bfc721643" ON "checkins" ("operatorId") `);
        await queryRunner.query(`CREATE TYPE "public"."users_roles_enum" AS ENUM('ADMIN', 'ORGANIZER', 'ATTENDEE')`);
        await queryRunner.query(`CREATE TYPE "public"."users_status_enum" AS ENUM('ACTIVE', 'SUSPENDED')`);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "email" citext NOT NULL, "phone" character varying(32), "password" text, "name" character varying(256), "roles" "public"."users_roles_enum" array NOT NULL DEFAULT '{ATTENDEE}', "status" "public"."users_status_enum" NOT NULL DEFAULT 'ACTIVE', CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_97672ac88f789774dd47f7c8be" ON "users" ("email") `);
        await queryRunner.query(`CREATE TABLE "order_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "orderId" uuid NOT NULL, "ticketTypeId" uuid NOT NULL, "qty" integer NOT NULL, "unitPriceCents" integer NOT NULL, "currency" character(3) NOT NULL DEFAULT 'KES', "order_id" uuid, "ticket_type_id" uuid, CONSTRAINT "PK_005269d8574e6fac0493715c308" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_f1d359a55923bb45b057fbdab0" ON "order_items" ("orderId") `);
        await queryRunner.query(`CREATE INDEX "IDX_4670c8ee386fe17b0c21bdef40" ON "order_items" ("ticketTypeId") `);
        await queryRunner.query(`CREATE TYPE "public"."payments_gateway_enum" AS ENUM('PAYSTACK')`);
        await queryRunner.query(`CREATE TYPE "public"."payments_status_enum" AS ENUM('INITIATED', 'AUTH_REQUIRED', 'SUCCESS', 'FAILED', 'REFUNDED')`);
        await queryRunner.query(`CREATE TABLE "payments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "orderId" uuid NOT NULL, "gateway" "public"."payments_gateway_enum" NOT NULL, "intentId" character varying(120) NOT NULL, "status" "public"."payments_status_enum" NOT NULL, "txRef" character varying(120), "amountCents" integer NOT NULL, "currency" character(3) NOT NULL DEFAULT 'KES', "rawPayload" jsonb, "order_id" uuid, CONSTRAINT "PK_197ab7af18c93fbb0c9b28b4a59" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_af929a5f2a400fdb6913b4967e" ON "payments" ("orderId") `);
        await queryRunner.query(`CREATE INDEX "IDX_addb78183c62467362f0ef1091" ON "payments" ("intentId") `);
        await queryRunner.query(`CREATE INDEX "IDX_32b41cdb985a296213e9a928b5" ON "payments" ("status") `);
        await queryRunner.query(`CREATE TYPE "public"."orders_status_enum" AS ENUM('DRAFT', 'PENDING', 'PAID', 'FAILED', 'REFUNDED', 'CANCELLED')`);
        await queryRunner.query(`CREATE TABLE "orders" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "userId" uuid, "eventId" uuid NOT NULL, "status" "public"."orders_status_enum" NOT NULL DEFAULT 'DRAFT', "amountCents" integer NOT NULL, "feesCents" integer NOT NULL DEFAULT '0', "currency" character(3) NOT NULL DEFAULT 'KES', "reference" character varying(64), "email" citext NOT NULL, "phone" character varying(32), "notes" text, "user_id" uuid, "event_id" uuid, CONSTRAINT "UQ_14ea6251b9edf64025257e7475b" UNIQUE ("reference"), CONSTRAINT "PK_710e2d4957aa5878dfe94e4ac2f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_80f390b083014fd69ec40b8c38" ON "orders" ("eventId") `);
        await queryRunner.query(`CREATE INDEX "IDX_775c9f06fc27ae3ff8fb26f2c4" ON "orders" ("status") `);
        await queryRunner.query(`CREATE INDEX "IDX_290bc8842ff16ea3be0f1a74c3" ON "orders" ("email") `);
        await queryRunner.query(`CREATE TYPE "public"."tickets_status_enum" AS ENUM('ISSUED', 'VOID', 'CHECKED_IN')`);
        await queryRunner.query(`CREATE TABLE "tickets" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "orderId" uuid NOT NULL, "ticketTypeId" uuid NOT NULL, "ownerUserId" uuid, "attendeeName" character varying(255), "attendeeEmail" citext, "attendeePhone" character varying(32), "status" "public"."tickets_status_enum" NOT NULL DEFAULT 'ISSUED', "qrNonce" character varying(120) NOT NULL, "qrSignature" character varying(512) NOT NULL, "order_id" uuid, "ticket_type_id" uuid, "owner_user_id" uuid, CONSTRAINT "PK_343bc942ae261cf7a1377f48fd0" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_e3e1e1e9d4ee34649da54a016e" ON "tickets" ("orderId") `);
        await queryRunner.query(`CREATE INDEX "IDX_9ff866ea2cad94fc6a8106e690" ON "tickets" ("ticketTypeId") `);
        await queryRunner.query(`CREATE INDEX "IDX_c37e9818eeaad9543032f6a6f1" ON "tickets" ("ownerUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_12b901b34113688b4786368510" ON "tickets" ("status") `);
        await queryRunner.query(`CREATE TYPE "public"."notifications_channel_enum" AS ENUM('EMAIL', 'SMS', 'WHATSAPP', 'PUSH')`);
        await queryRunner.query(`CREATE TYPE "public"."notifications_status_enum" AS ENUM('PENDING', 'SENT', 'FAILED')`);
        await queryRunner.query(`CREATE TABLE "notifications" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "channel" "public"."notifications_channel_enum" NOT NULL, "template" character varying(120), "to" character varying(255) NOT NULL, "payload" jsonb, "status" "public"."notifications_status_enum" NOT NULL DEFAULT 'PENDING', "error" text, CONSTRAINT "PK_6a72c3c0f683f6462415e653c3a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_0fc9fe9a0d500d8275ee4bbc4c" ON "notifications" ("channel") `);
        await queryRunner.query(`CREATE INDEX "IDX_92f5d3a7779be163cbea7916c6" ON "notifications" ("status") `);
        await queryRunner.query(`ALTER TABLE "coupons" ADD CONSTRAINT "FK_1b76397b818debe273100552403" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "ticket_types" ADD CONSTRAINT "FK_9dfa62b35548ea1e0b7e4675b20" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "events" ADD CONSTRAINT "FK_14c9ce53a2c2a1c781b8390123e" FOREIGN KEY ("organizer_id") REFERENCES "organizer_profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "organizer_profiles" ADD CONSTRAINT "FK_ea845db509307bc33365054eacc" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "checkins" ADD CONSTRAINT "FK_7067db8aa287c2ff4ac3a0b578b" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "checkins" ADD CONSTRAINT "FK_b17d2c1dcb805edbe5581563336" FOREIGN KEY ("operator_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "order_items" ADD CONSTRAINT "FK_145532db85752b29c57d2b7b1f1" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "order_items" ADD CONSTRAINT "FK_41292b9bdd561fb442a064705d7" FOREIGN KEY ("ticket_type_id") REFERENCES "ticket_types"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "payments" ADD CONSTRAINT "FK_b2f7b823a21562eeca20e72b006" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "orders" ADD CONSTRAINT "FK_a922b820eeef29ac1c6800e826a" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "orders" ADD CONSTRAINT "FK_642ca308ac51fea8327e593b8ab" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "tickets" ADD CONSTRAINT "FK_bd5636236f799b19f132abf8d70" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "tickets" ADD CONSTRAINT "FK_a95369aeea12da7fde110e95e00" FOREIGN KEY ("ticket_type_id") REFERENCES "ticket_types"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "tickets" ADD CONSTRAINT "FK_4d519b976106477e484d1a5a5f9" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    /**
     * @param {QueryRunner} queryRunner
     */
    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "tickets" DROP CONSTRAINT "FK_4d519b976106477e484d1a5a5f9"`);
        await queryRunner.query(`ALTER TABLE "tickets" DROP CONSTRAINT "FK_a95369aeea12da7fde110e95e00"`);
        await queryRunner.query(`ALTER TABLE "tickets" DROP CONSTRAINT "FK_bd5636236f799b19f132abf8d70"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP CONSTRAINT "FK_642ca308ac51fea8327e593b8ab"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP CONSTRAINT "FK_a922b820eeef29ac1c6800e826a"`);
        await queryRunner.query(`ALTER TABLE "payments" DROP CONSTRAINT "FK_b2f7b823a21562eeca20e72b006"`);
        await queryRunner.query(`ALTER TABLE "order_items" DROP CONSTRAINT "FK_41292b9bdd561fb442a064705d7"`);
        await queryRunner.query(`ALTER TABLE "order_items" DROP CONSTRAINT "FK_145532db85752b29c57d2b7b1f1"`);
        await queryRunner.query(`ALTER TABLE "checkins" DROP CONSTRAINT "FK_b17d2c1dcb805edbe5581563336"`);
        await queryRunner.query(`ALTER TABLE "checkins" DROP CONSTRAINT "FK_7067db8aa287c2ff4ac3a0b578b"`);
        await queryRunner.query(`ALTER TABLE "organizer_profiles" DROP CONSTRAINT "FK_ea845db509307bc33365054eacc"`);
        await queryRunner.query(`ALTER TABLE "events" DROP CONSTRAINT "FK_14c9ce53a2c2a1c781b8390123e"`);
        await queryRunner.query(`ALTER TABLE "ticket_types" DROP CONSTRAINT "FK_9dfa62b35548ea1e0b7e4675b20"`);
        await queryRunner.query(`ALTER TABLE "coupons" DROP CONSTRAINT "FK_1b76397b818debe273100552403"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_92f5d3a7779be163cbea7916c6"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0fc9fe9a0d500d8275ee4bbc4c"`);
        await queryRunner.query(`DROP TABLE "notifications"`);
        await queryRunner.query(`DROP TYPE "public"."notifications_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."notifications_channel_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_12b901b34113688b4786368510"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c37e9818eeaad9543032f6a6f1"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9ff866ea2cad94fc6a8106e690"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e3e1e1e9d4ee34649da54a016e"`);
        await queryRunner.query(`DROP TABLE "tickets"`);
        await queryRunner.query(`DROP TYPE "public"."tickets_status_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_290bc8842ff16ea3be0f1a74c3"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_775c9f06fc27ae3ff8fb26f2c4"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_80f390b083014fd69ec40b8c38"`);
        await queryRunner.query(`DROP TABLE "orders"`);
        await queryRunner.query(`DROP TYPE "public"."orders_status_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_32b41cdb985a296213e9a928b5"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_addb78183c62467362f0ef1091"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_af929a5f2a400fdb6913b4967e"`);
        await queryRunner.query(`DROP TABLE "payments"`);
        await queryRunner.query(`DROP TYPE "public"."payments_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."payments_gateway_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_4670c8ee386fe17b0c21bdef40"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f1d359a55923bb45b057fbdab0"`);
        await queryRunner.query(`DROP TABLE "order_items"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_97672ac88f789774dd47f7c8be"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TYPE "public"."users_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."users_roles_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a76f535abddc02ce2bfc721643"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_23a4509421eb1240d870717aff"`);
        await queryRunner.query(`DROP TABLE "checkins"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ffd03e2338254f8358702eceab"`);
        await queryRunner.query(`DROP TABLE "organizer_profiles"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_03dcebc1ab44daa177ae9479c4"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_dad02f90491c8dfe2610d05f8d"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_7832b74193ded0a67048b5d598"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1024d476207981d1c72232cf3c"`);
        await queryRunner.query(`DROP TABLE "events"`);
        await queryRunner.query(`DROP TYPE "public"."events_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."events_type_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0bf6c025aea56d71d7c0a019f9"`);
        await queryRunner.query(`DROP TABLE "ticket_types"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1333c687be50e828f38e8c192c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e025109230e82925843f2a14c4"`);
        await queryRunner.query(`DROP TABLE "coupons"`);
        await queryRunner.query(`DROP TYPE "public"."coupons_kind_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9d614a1c2586d36302bf341597"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_860377b8e653e308a6e36db575"`);
        await queryRunner.query(`DROP TABLE "webhook_events"`);
    }
}
