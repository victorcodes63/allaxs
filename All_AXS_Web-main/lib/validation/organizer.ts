import { z } from "zod";

const phoneDigitsOk = (v: string) => v.replace(/\D/g, "").length >= 8;

export const organizerOnboardingSchema = z
  .object({
    orgName: z
      .string()
      .min(2, "Organization name must be at least 2 characters")
      .max(100, "Organization name must be less than 100 characters"),
    legalName: z
      .string()
      .trim()
      .min(2, "Legal name must be at least 2 characters (as on bank records)")
      .max(100, "Legal name must be less than 100 characters"),
    website: z
      .string()
      .url("Please enter a valid URL")
      .optional()
      .or(z.literal("")),
    supportEmail: z.string().email("Please enter a valid email address"),
    supportPhone: z
      .string()
      .trim()
      .min(8, "Support phone must be at least 8 characters")
      .max(32, "Support phone is too long")
      .refine(phoneDigitsOk, {
        message: "Support phone must include at least 8 digits (use country code, e.g. +254…)",
      }),

    payoutMethod: z.enum(["BANK_ACCOUNT", "MPESA", "OTHER"], {
      message: "Please select a payout method",
    }),

    bankName: z.string().optional(),
    bankAccountName: z.string().optional(),
    bankAccountNumber: z.string().optional(),

    mpesaPaybill: z.string().optional(),
    mpesaTillNumber: z.string().optional(),

    payoutInstructions: z.string().optional(),
    taxId: z
      .string()
      .trim()
      .min(3, "Tax or business ID is required (e.g. PIN, VAT, company number)")
      .max(64, "Tax ID is too long"),
  })
  .refine(
    (data) => {
      if (data.payoutMethod === "BANK_ACCOUNT") {
        return (
          data.bankName &&
          data.bankName.trim().length > 0 &&
          data.bankAccountName &&
          data.bankAccountName.trim().length > 0 &&
          data.bankAccountNumber &&
          data.bankAccountNumber.trim().length > 0
        );
      }
      return true;
    },
    {
      message:
        "Bank name, account name, and account number are required for bank account payouts",
      path: ["bankName"],
    },
  )
  .refine(
    (data) => {
      if (data.payoutMethod === "MPESA") {
        return (
          (data.mpesaPaybill && data.mpesaPaybill.trim().length > 0) ||
          (data.mpesaTillNumber && data.mpesaTillNumber.trim().length > 0)
        );
      }
      return true;
    },
    {
      message: "At least one of Paybill or Till Number is required for M-Pesa",
      path: ["mpesaPaybill"],
    },
  )
  .refine(
    (data) => {
      if (data.payoutMethod !== "OTHER") return true;
      const t = (data.payoutInstructions ?? "").trim();
      return t.length >= 24;
    },
    {
      message:
        "Payout instructions must be at least 24 characters when using “Other” (include routing details)",
      path: ["payoutInstructions"],
    },
  );

export type OrganizerOnboardingInput = z.infer<typeof organizerOnboardingSchema>;
