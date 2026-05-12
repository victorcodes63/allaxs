/**
 * Admin routes render inside `HubAppShell`, which already applies max width and
 * horizontal padding (`HUB_MAIN_MAX` + `HUB_MAIN_PAD`). Use this class on page
 * roots so content is not double-inset on small screens, and the home indicator
 * safe area is respected.
 */
export const ADMIN_PAGE_SHELL =
  "w-full min-w-0 pb-[max(0.75rem,env(safe-area-inset-bottom)))]";
