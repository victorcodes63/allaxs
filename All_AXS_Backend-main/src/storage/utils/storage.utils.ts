/**
 * Utility functions for storage operations
 */

/**
 * Get file extension from MIME type
 */
export function getExtensionFromMime(mime: string): string {
  const mimeToExt: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
  };

  return mimeToExt[mime.toLowerCase()] || 'jpg';
}

/**
 * Generate storage key for event banner
 */
export function generateEventBannerKey(eventId: string, mime: string): string {
  const ext = getExtensionFromMime(mime);
  return `events/${eventId}/banner.${ext}`;
}

/**
 * Parse allowed MIME types from environment variable
 */
export function parseAllowedMimeTypes(mimeString?: string): Set<string> {
  if (!mimeString) {
    // Default allowed MIME types
    return new Set([
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
    ]);
  }

  return new Set(
    mimeString
      .split(',')
      .map((m) => m.trim())
      .filter((m) => m.length > 0),
  );
}

/**
 * Validate MIME type against allowed types
 */
export function validateMimeType(
  mime: string,
  allowedMimeTypes: Set<string>,
): boolean {
  return allowedMimeTypes.has(mime.toLowerCase());
}

/**
 * Validate URL matches expected pattern for event banner
 */
export function validateBannerUrl(
  url: string,
  eventId: string,
  expectedBaseUrl?: string,
): boolean {
  try {
    const urlObj = new URL(url);

    // If expected base URL is provided, validate host
    if (expectedBaseUrl) {
      const expectedUrl = new URL(expectedBaseUrl);
      if (urlObj.hostname !== expectedUrl.hostname) {
        return false;
      }
    }

    // Validate path matches pattern: events/{eventId}/banner.{ext}
    // Allow for paths like /static/events/{id}/banner.jpg or /events/{id}/banner.jpg
    const pathMatch = urlObj.pathname.match(
      /^\/?.*events\/([^/]+)\/banner\.\w+$/,
    );
    if (!pathMatch) {
      return false;
    }

    // Validate event ID matches
    return pathMatch[1] === eventId;
  } catch {
    return false;
  }
}
