import { z } from "zod";

export enum EventType {
  IN_PERSON = "IN_PERSON",
  VIRTUAL = "VIRTUAL",
  HYBRID = "HYBRID",
}

export enum EventStatus {
  DRAFT = "DRAFT",
  PENDING_REVIEW = "PENDING_REVIEW",
  APPROVED = "APPROVED",
  PUBLISHED = "PUBLISHED",
  REJECTED = "REJECTED",
  ARCHIVED = "ARCHIVED",
}

export const eventDetailsSchema = z
  .object({
    title: z
      .string()
      .min(1, "Title is required")
      .max(180, "Title must be at most 180 characters"),
    type: z.nativeEnum(EventType, {
      message: "Event type is required",
    }),
    venue: z.string().max(255).optional(),
    startsAt: z.string().min(1, "Start date is required"),
    endsAt: z.string().min(1, "End date is required"),
    description: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.startsAt && data.endsAt) {
        return new Date(data.endsAt) > new Date(data.startsAt);
      }
      return true;
    },
    {
      message: "End date must be after start date",
      path: ["endsAt"],
    }
  )
  .refine(
    (data) => {
      if (
        (data.type === EventType.IN_PERSON || data.type === EventType.HYBRID) &&
        !data.venue?.trim()
      ) {
        return false;
      }
      return true;
    },
    {
      message: "Venue is required for in-person and hybrid events",
      path: ["venue"],
    }
  );

export type EventDetailsInput = z.infer<typeof eventDetailsSchema>;

const installmentSplitSchema = z.object({
  seq: z.number().int().min(1),
  pct: z.number().min(0).max(100),
  dueAfterDays: z.number().int().min(0),
});

const installmentConfigSchema = z
  .object({
    mode: z.literal("PERCENT_SPLITS"),
    splits: z
      .array(installmentSplitSchema)
      .min(2, "At least 2 payment splits are required"),
    minDepositPct: z.number().min(0).max(100).optional(),
    gracePeriodDays: z.number().int().min(0).optional(),
    autoCancelOnDefault: z.boolean().optional(),
  })
  .refine(
    (data) => {
      const totalPct = data.splits.reduce((sum, split) => sum + split.pct, 0);
      return Math.abs(totalPct - 100) < 0.01;
    },
    {
      message: "Sum of percentages must equal 100%",
      path: ["splits"],
    }
  )
  .refine(
    (data) => {
      const sorted = [...data.splits].sort((a, b) => a.seq - b.seq);
      for (let i = 0; i < sorted.length; i++) {
        if (sorted[i].seq !== i + 1) return false;
      }
      return true;
    },
    {
      message: "Sequence numbers must be strictly increasing starting from 1",
      path: ["splits"],
    }
  )
  .refine(
    (data) => {
      const sorted = [...data.splits].sort((a, b) => a.seq - b.seq);
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i].dueAfterDays < sorted[i - 1].dueAfterDays) return false;
      }
      return true;
    },
    {
      message: "dueAfterDays must be non-decreasing",
      path: ["splits"],
    }
  )
  .refine(
    (data) => {
      if (data.minDepositPct !== undefined) {
        const sorted = [...data.splits].sort((a, b) => a.seq - b.seq);
        return sorted[0].pct >= data.minDepositPct;
      }
      return true;
    },
    {
      message: "First split percentage must be >= minimum deposit",
      path: ["splits"],
    }
  );

export const ticketTierSchema = z
  .object({
    name: z
      .string()
      .min(1, "Name is required")
      .max(120, "Name must be at most 120 characters"),
    description: z.string().optional(),
    priceCents: z.number().min(0, "Price must be non-negative"),
    quantity: z
      .number()
      .int("Quantity must be an integer")
      .min(0, "Quantity must be non-negative"),
    maxPerOrder: z
      .number()
      .int("Max per order must be an integer")
      .min(1, "Max per order must be at least 1")
      .optional(),
    salesStartAt: z.string().optional(),
    salesEndAt: z.string().optional(),
    allowInstallments: z.boolean().optional(),
    installmentConfig: installmentConfigSchema.optional(),
  })
  .refine(
    (data) => {
      // Only require config if installments are explicitly enabled
      if (data.allowInstallments === true) {
        if (!data.installmentConfig) {
          return false;
        }
        // Ensure splits exist and are valid
        if (!data.installmentConfig.splits || data.installmentConfig.splits.length < 2) {
          return false;
        }
      }
      return true;
    },
    {
      message: "Installment configuration with at least 2 splits is required when installments are enabled",
      path: ["installmentConfig"],
    }
  );

export type TicketTierInput = z.infer<typeof ticketTierSchema>;

