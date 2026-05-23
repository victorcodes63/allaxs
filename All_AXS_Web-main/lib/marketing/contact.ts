import { z } from "zod";

export const CONTACT_SUBJECTS = [
  "General",
  "Organizer inquiry",
  "Refund help",
  "Partnership",
] as const;

export type ContactSubject = (typeof CONTACT_SUBJECTS)[number];

export const contactFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Please share your name (at least 2 characters)")
    .max(120, "Name is too long"),
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .max(254, "Email is too long")
    .email("Please enter a valid email address"),
  subject: z.enum(CONTACT_SUBJECTS, {
    message: "Please pick a topic",
  }),
  message: z
    .string()
    .trim()
    .min(10, "Message must be at least 10 characters")
    .max(5000, "Message is too long (max 5,000 characters)"),
});

export type ContactFormInput = z.infer<typeof contactFormSchema>;
