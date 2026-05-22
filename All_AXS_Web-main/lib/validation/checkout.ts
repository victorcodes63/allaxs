import { z } from "zod";

const checkoutLineSchema = z.object({
  ticketTypeId: z.string().uuid("Invalid ticket type"),
  quantity: z.number().int().min(1).max(50),
});

export const guestPaystackInitSchema = z.object({
  eventId: z.string().uuid("Invalid event"),
  lines: z.array(checkoutLineSchema).min(1, "Choose at least one ticket"),
  buyerName: z
    .string()
    .trim()
    .min(2, "Full name is required")
    .max(100, "Name is too long"),
  buyerEmail: z.string().trim().email("Enter a valid email address"),
  buyerPhone: z
    .string()
    .trim()
    .max(32, "Phone number is too long")
    .optional()
    .or(z.literal("")),
  couponCode: z.string().trim().max(64).optional(),
  payInInstallments: z.boolean().optional(),
});

export type GuestPaystackInitInput = z.infer<typeof guestPaystackInitSchema>;

export const compCheckoutInitSchema = z.object({
  slug: z.string().trim().min(1).max(200),
  compToken: z
    .string()
    .trim()
    .min(16)
    .max(64)
    .regex(/^[A-Za-z0-9_-]+$/, "Invalid comp link"),
  buyerName: z
    .string()
    .trim()
    .min(2, "Full name is required")
    .max(100, "Name is too long"),
  buyerEmail: z.string().trim().email("Enter a valid email address"),
  buyerPhone: z
    .string()
    .trim()
    .max(32, "Phone number is too long")
    .optional()
    .or(z.literal("")),
});

export type CompCheckoutInitInput = z.infer<typeof compCheckoutInitSchema>;

export function isValidEmailFormat(email: string): boolean {
  return z.string().email().safeParse(email.trim()).success;
}
