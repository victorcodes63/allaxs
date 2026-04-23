import { z } from "zod";

export const organizerOnboardingSchema = z
  .object({
    // Organization details
    orgName: z
      .string()
      .min(2, "Organization name must be at least 2 characters")
      .max(100, "Organization name must be less than 100 characters"),
    legalName: z
      .string()
      .max(100, "Legal name must be less than 100 characters")
      .optional(),
    website: z
      .string()
      .url("Please enter a valid URL")
      .optional()
      .or(z.literal("")),
    supportEmail: z.string().email("Please enter a valid email address"),
    supportPhone: z
      .string()
      .max(20, "Phone number must be less than 20 characters")
      .optional()
      .or(z.literal("")),

  // Payout method
  payoutMethod: z.enum(["BANK_ACCOUNT", "MPESA", "OTHER"], {
    message: "Please select a payout method",
  }),

    // Bank account fields (conditional)
    bankName: z.string().optional(),
    bankAccountName: z.string().optional(),
    bankAccountNumber: z.string().optional(),

    // MPESA fields (conditional)
    mpesaPaybill: z.string().optional(),
    mpesaTillNumber: z.string().optional(),

    // Other payout fields
    payoutInstructions: z.string().optional(),
    taxId: z.string().optional(),
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
    }
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
      message: "At least one of Paybill or Till Number is required for MPESA",
      path: ["mpesaPaybill"],
    }
  );

export type OrganizerOnboardingInput = z.infer<
  typeof organizerOnboardingSchema
>;


