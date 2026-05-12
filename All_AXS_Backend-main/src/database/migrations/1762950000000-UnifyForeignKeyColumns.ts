import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Drops the duplicate camelCase foreign-key columns that were left over when
 * entities started using `@JoinColumn({ name: 'snake_case' })` but kept the
 * old `@Column` declarations on the same property — TypeORM ended up creating
 * BOTH physical columns. Data was actually being written to the camelCase
 * column (via the `@Column` decorator), while the FK constraint pointed at
 * the empty snake_case column.
 *
 * Direction: converge everything on snake_case to match the rest of the
 * schema (e.g. `support_email`, `legal_name`, `organizer_id`) and the
 * precedent set by `FixEventsOrganizerColumn1762434000000`.
 *
 * Steps per pair (executed in order):
 *   1. Backfill snake_case from camelCase (idempotent).
 *   2. Drop dependent indexes / constraints on the camelCase column
 *      (including composite indexes like `IDX_ticket_types_event_name_unique`).
 *   3. Drop the camelCase column itself.
 *   4. Enforce NOT NULL on snake_case where the entity requires it.
 *   5. Recreate any composite indexes on the snake_case column.
 *   6. Create a stable, predictably-named index on the snake_case column so
 *      query plans keep using btree lookups after the camelCase index is gone.
 *
 * The pre-existing snake_case FK constraints are untouched.
 *
 * `down()` rebuilds the camelCase column, backfills from snake_case, restores
 * the original indexes/constraints and NOT NULL, and reverses the composite
 * index rebuild.
 */
export class UnifyForeignKeyColumns1762950000000
  implements MigrationInterface
{
  name = 'UnifyForeignKeyColumns1762950000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const pair of PAIRS) {
      // Defensive orphan cleanup: rows whose camelCase FK no longer exists
      // in the parent table would fail the snake_case FK constraint when we
      // backfill. For NOT NULL FKs the only option is to delete; for
      // nullable FKs we NULL the orphan reference instead.
      if (pair.references) {
        if (pair.nullable) {
          await queryRunner.query(
            `UPDATE "${pair.table}"
             SET "${pair.camel}" = NULL
             WHERE "${pair.camel}" IS NOT NULL
               AND NOT EXISTS (
                 SELECT 1 FROM "${pair.references.table}" parent
                 WHERE parent."${pair.references.column}" = "${pair.table}"."${pair.camel}"
               )`,
          );
        } else {
          await queryRunner.query(
            `DELETE FROM "${pair.table}"
             WHERE "${pair.camel}" IS NOT NULL
               AND NOT EXISTS (
                 SELECT 1 FROM "${pair.references.table}" parent
                 WHERE parent."${pair.references.column}" = "${pair.table}"."${pair.camel}"
               )`,
          );
        }
      }

      await queryRunner.query(
        `UPDATE "${pair.table}"
         SET "${pair.snake}" = "${pair.camel}"
         WHERE "${pair.snake}" IS NULL AND "${pair.camel}" IS NOT NULL`,
      );

      for (const indexName of pair.camelIndexes) {
        await queryRunner.query(`DROP INDEX IF EXISTS "${indexName}"`);
      }
      for (const constraintName of pair.camelUniqueConstraints ?? []) {
        await queryRunner.query(
          `ALTER TABLE "${pair.table}" DROP CONSTRAINT IF EXISTS "${constraintName}"`,
        );
      }

      // Drop any composite/expression indexes that reference the camelCase
      // column before the column itself is removed (Postgres would otherwise
      // refuse the DROP COLUMN with a dependency error).
      for (const composite of pair.compositeIndexes ?? []) {
        await queryRunner.query(`DROP INDEX IF EXISTS "${composite.name}"`);
      }

      await queryRunner.query(
        `ALTER TABLE "${pair.table}" DROP COLUMN IF EXISTS "${pair.camel}"`,
      );

      if (!pair.nullable) {
        await queryRunner.query(
          `ALTER TABLE "${pair.table}" ALTER COLUMN "${pair.snake}" SET NOT NULL`,
        );
      }

      // Recreate composite indexes against the snake_case column.
      for (const composite of pair.compositeIndexes ?? []) {
        await queryRunner.query(composite.upDDL);
      }

      if (pair.uniqueIndex) {
        await queryRunner.query(
          `CREATE UNIQUE INDEX IF NOT EXISTS "${stableIndexName(pair)}" ON "${pair.table}" ("${pair.snake}")`,
        );
      } else {
        await queryRunner.query(
          `CREATE INDEX IF NOT EXISTS "${stableIndexName(pair)}" ON "${pair.table}" ("${pair.snake}")`,
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reverse order so any inter-table dependencies unwind cleanly.
    for (const pair of [...PAIRS].reverse()) {
      await queryRunner.query(
        `DROP INDEX IF EXISTS "${stableIndexName(pair)}"`,
      );

      // Drop the composite indexes we recreated on snake_case so the camelCase
      // versions can take their place.
      for (const composite of pair.compositeIndexes ?? []) {
        await queryRunner.query(`DROP INDEX IF EXISTS "${composite.name}"`);
      }

      await queryRunner.query(
        `ALTER TABLE "${pair.table}" ADD COLUMN IF NOT EXISTS "${pair.camel}" uuid`,
      );

      await queryRunner.query(
        `UPDATE "${pair.table}"
         SET "${pair.camel}" = "${pair.snake}"
         WHERE "${pair.camel}" IS NULL AND "${pair.snake}" IS NOT NULL`,
      );

      if (!pair.nullable) {
        await queryRunner.query(
          `ALTER TABLE "${pair.table}" ALTER COLUMN "${pair.camel}" SET NOT NULL`,
        );
      }

      const firstIndex = pair.camelIndexes[0];
      if (firstIndex) {
        if (pair.uniqueIndex) {
          await queryRunner.query(
            `CREATE UNIQUE INDEX IF NOT EXISTS "${firstIndex}" ON "${pair.table}" ("${pair.camel}")`,
          );
        } else {
          await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "${firstIndex}" ON "${pair.table}" ("${pair.camel}")`,
          );
        }
      }
      for (const constraintName of pair.camelUniqueConstraints ?? []) {
        await queryRunner.query(
          `ALTER TABLE "${pair.table}" ADD CONSTRAINT "${constraintName}" UNIQUE ("${pair.camel}")`,
        );
      }
      for (const composite of pair.compositeIndexes ?? []) {
        await queryRunner.query(composite.downDDL);
      }
    }
  }
}

interface CompositeIndex {
  /** Name of the composite/expression index (same in both directions). */
  name: string;
  /** DDL to recreate the index against snake_case in `up()`. */
  upDDL: string;
  /** DDL to recreate the index against camelCase in `down()`. */
  downDDL: string;
}

interface ColumnPair {
  table: string;
  camel: string;
  snake: string;
  /** Whether the snake_case column should remain nullable after migration. */
  nullable: boolean;
  /** Whether the index on snake_case should be unique. */
  uniqueIndex?: boolean;
  /**
   * Names of single-column indexes on the camelCase column (must be dropped
   * before the column itself can be removed). The first entry is recreated
   * in `down()` to restore the original schema.
   */
  camelIndexes: string[];
  /**
   * Optional unique constraints (separate from indexes) on the camelCase
   * column. Only `organizer_profiles.userId` has one.
   */
  camelUniqueConstraints?: string[];
  /**
   * Composite or expression indexes that reference the camelCase column.
   * Each entry is dropped in `up()` before the column is removed and
   * recreated against the snake_case column afterwards.
   */
  compositeIndexes?: CompositeIndex[];
  /**
   * Parent table/column this FK refers to. Used to detect and clean up
   * orphan rows before backfilling the snake_case column, so the migration
   * doesn't fail FK validation on legacy demo data.
   */
  references?: { table: string; column: string };
}

/**
 * Stable, predictable index name we own going forward. Matches the naming
 * style used by `FixEventsOrganizerColumn1762434000000` (`IDX_events_organizer_id`).
 */
function stableIndexName(pair: ColumnPair): string {
  return `IDX_${pair.table}_${pair.snake}`;
}

/**
 * Every (table, camelCase, snake_case) pair to unify. Indexes/constraints
 * are listed here so `up()`/`down()` can drop/recreate them in one place.
 */
const PAIRS: ReadonlyArray<ColumnPair> = [
  {
    table: 'orders',
    camel: 'userId',
    snake: 'user_id',
    nullable: true,
    camelIndexes: [], // No index existed on orders."userId" historically.
    references: { table: 'users', column: 'id' },
  },
  {
    table: 'orders',
    camel: 'eventId',
    snake: 'event_id',
    nullable: false,
    camelIndexes: ['IDX_80f390b083014fd69ec40b8c38'],
    references: { table: 'events', column: 'id' },
  },
  {
    table: 'order_items',
    camel: 'orderId',
    snake: 'order_id',
    nullable: false,
    camelIndexes: ['IDX_f1d359a55923bb45b057fbdab0'],
    references: { table: 'orders', column: 'id' },
  },
  {
    table: 'order_items',
    camel: 'ticketTypeId',
    snake: 'ticket_type_id',
    nullable: false,
    camelIndexes: ['IDX_4670c8ee386fe17b0c21bdef40'],
    references: { table: 'ticket_types', column: 'id' },
  },
  {
    table: 'organizer_profiles',
    camel: 'userId',
    snake: 'user_id',
    nullable: false,
    uniqueIndex: true,
    camelIndexes: ['IDX_ffd03e2338254f8358702eceab'],
    camelUniqueConstraints: ['UQ_ffd03e2338254f8358702eceabb'],
    references: { table: 'users', column: 'id' },
  },
  {
    table: 'tickets',
    camel: 'orderId',
    snake: 'order_id',
    nullable: false,
    camelIndexes: ['IDX_e3e1e1e9d4ee34649da54a016e'],
    references: { table: 'orders', column: 'id' },
  },
  {
    table: 'tickets',
    camel: 'ownerUserId',
    snake: 'owner_user_id',
    nullable: true,
    camelIndexes: ['IDX_c37e9818eeaad9543032f6a6f1'],
    references: { table: 'users', column: 'id' },
  },
  {
    table: 'tickets',
    camel: 'ticketTypeId',
    snake: 'ticket_type_id',
    nullable: false,
    camelIndexes: ['IDX_9ff866ea2cad94fc6a8106e690'],
    references: { table: 'ticket_types', column: 'id' },
  },
  {
    table: 'payments',
    camel: 'orderId',
    snake: 'order_id',
    nullable: false,
    camelIndexes: ['IDX_af929a5f2a400fdb6913b4967e'],
    references: { table: 'orders', column: 'id' },
  },
  {
    table: 'payment_plans',
    camel: 'orderId',
    snake: 'order_id',
    nullable: false,
    camelIndexes: ['IDX_payment_plans_order'],
    references: { table: 'orders', column: 'id' },
  },
  {
    table: 'payment_plans',
    camel: 'ticketTypeId',
    snake: 'ticket_type_id',
    nullable: false,
    camelIndexes: ['IDX_payment_plans_ticket_type'],
    references: { table: 'ticket_types', column: 'id' },
  },
  {
    table: 'coupons',
    camel: 'eventId',
    snake: 'event_id',
    nullable: true,
    camelIndexes: ['IDX_1333c687be50e828f38e8c192c'],
    references: { table: 'events', column: 'id' },
  },
  {
    table: 'checkins',
    camel: 'ticketId',
    snake: 'ticket_id',
    nullable: false,
    camelIndexes: ['IDX_23a4509421eb1240d870717aff'],
    references: { table: 'tickets', column: 'id' },
  },
  {
    table: 'checkins',
    camel: 'operatorId',
    snake: 'operator_id',
    nullable: true,
    camelIndexes: ['IDX_a76f535abddc02ce2bfc721643'],
    references: { table: 'users', column: 'id' },
  },
  {
    table: 'ticket_types',
    camel: 'eventId',
    snake: 'event_id',
    nullable: false,
    camelIndexes: ['IDX_0bf6c025aea56d71d7c0a019f9'],
    references: { table: 'events', column: 'id' },
    compositeIndexes: [
      {
        name: 'IDX_ticket_types_event_name_unique',
        // Created originally by 1762800000000-AddTicketTypeDescriptionAndStatus.
        // Prevents duplicate ticket-type names per event (case-insensitive).
        upDDL: `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_ticket_types_event_name_unique"
                ON "ticket_types" ("event_id", LOWER("name"))`,
        downDDL: `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_ticket_types_event_name_unique"
                  ON "ticket_types" ("eventId", LOWER("name"))`,
      },
    ],
  },
  {
    table: 'payment_installments',
    camel: 'planId',
    snake: 'plan_id',
    nullable: false,
    camelIndexes: ['IDX_payment_installments_plan'],
    references: { table: 'payment_plans', column: 'id' },
    compositeIndexes: [
      {
        // Composite index on (plan_id, sequence) so per-plan ordered scans
        // stay fast. Created by 1762900000000-AddInstallmentPayments.
        name: 'IDX_payment_installments_sequence',
        upDDL: `CREATE INDEX IF NOT EXISTS "IDX_payment_installments_sequence"
                ON "payment_installments" ("plan_id", sequence)`,
        downDDL: `CREATE INDEX IF NOT EXISTS "IDX_payment_installments_sequence"
                  ON "payment_installments" ("planId", sequence)`,
      },
    ],
  },
];
