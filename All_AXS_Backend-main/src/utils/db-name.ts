/**
 * Utility functions for extracting database name from connection URLs
 */

/**
 * Extracts the database name from a PostgreSQL connection URL
 * @param url - Database connection URL (e.g., postgres://user:pass@host:port/dbname)
 * @returns Database name or empty string if parsing fails
 */
export function getDbNameFromUrl(url: string): string {
  if (!url) {
    return '';
  }

  try {
    const urlObj = new URL(url);
    // Remove leading slash from pathname
    return (urlObj.pathname || '').replace(/^\//, '');
  } catch {
    // If URL parsing fails, try to extract from connection string format
    // postgres://user:pass@host:port/dbname
    const match = url.match(/\/([^/?]+)(\?|$)/);
    return match ? match[1] : '';
  }
}

/**
 * Extracts the database name from individual connection parameters
 * @param host - Database host
 * @param port - Database port
 * @param database - Database name
 * @param user - Database user
 * @returns Database name
 */
export function getDbNameFromParams(database?: string): string {
  return database || '';
}
