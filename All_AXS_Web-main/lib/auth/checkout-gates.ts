/** Stable API error when guest checkout uses an email that already has a full account. */
export const CHECKOUT_SIGN_IN_REQUIRED_CODE = "SIGN_IN_REQUIRED";

export function isCheckoutSignInRequiredError(data: {
  code?: string;
  message?: unknown;
}): boolean {
  if (data.code === CHECKOUT_SIGN_IN_REQUIRED_CODE) return true;
  if (
    typeof data.message === "object" &&
    data.message !== null &&
    (data.message as { code?: string }).code === CHECKOUT_SIGN_IN_REQUIRED_CODE
  ) {
    return true;
  }
  return false;
}
