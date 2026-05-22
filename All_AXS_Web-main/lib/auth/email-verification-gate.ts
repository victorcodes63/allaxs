/** Stable API error code when signed-in checkout is blocked pending verification. */
export const CHECKOUT_EMAIL_NOT_VERIFIED_CODE = "emailNotVerified";

export function isCheckoutEmailNotVerifiedError(data: {
  code?: string;
  message?: unknown;
}): boolean {
  if (data.code === CHECKOUT_EMAIL_NOT_VERIFIED_CODE) return true;
  if (
    typeof data.message === "object" &&
    data.message !== null &&
    (data.message as { code?: string }).code === CHECKOUT_EMAIL_NOT_VERIFIED_CODE
  ) {
    return true;
  }
  return false;
}
