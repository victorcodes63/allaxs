/** Default platform support inbox when organizer support email is missing. */
export const DEFAULT_PLATFORM_SUPPORT_EMAIL = 'tech@youthplusafrica.com';

export function resolvePlatformSupportEmail(): string {
  const fromEnv = process.env.PLATFORM_SUPPORT_EMAIL?.trim();
  return fromEnv || DEFAULT_PLATFORM_SUPPORT_EMAIL;
}
