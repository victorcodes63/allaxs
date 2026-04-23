/**
 * Jest global teardown
 * No-op: E2E test database is persistent across runs
 * Database is not dropped or truncated
 */

export default async function globalTeardown(): Promise<void> {
  // No-op: database persists across test runs
  // Tests clean up their own data via afterEach/afterAll hooks
  console.log(
    '[JEST GLOBAL TEARDOWN] Test database persists (no drop/truncate)',
  );
}
