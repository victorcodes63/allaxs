/** Map backend captcha error codes to user-facing copy. */
export function captchaErrorMessage(code?: string, fallback?: string): string {
  switch (code) {
    case "captchaRequired":
      return "Please complete the security check.";
    case "captchaFailed":
      return "Security verification failed. Try again.";
    case "captchaNotConfigured":
      return "Security verification is temporarily unavailable. Please try again later.";
    default:
      return fallback || "An error occurred. Please try again.";
  }
}

export function isCaptchaErrorCode(code?: string): boolean {
  return !!code?.startsWith("captcha");
}
