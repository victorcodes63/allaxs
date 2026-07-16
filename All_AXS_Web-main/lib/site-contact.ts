/** Platform-wide All AXS support inbox (not per-organizer `supportEmail`). */
export const PLATFORM_SUPPORT_EMAIL = "tech@youthplusafrica.com";

export function platformSupportMailto(options?: { subject?: string }): string {
  const subject = options?.subject?.trim();
  if (!subject) return `mailto:${PLATFORM_SUPPORT_EMAIL}`;
  return `mailto:${PLATFORM_SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`;
}
