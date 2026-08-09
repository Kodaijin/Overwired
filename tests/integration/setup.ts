/**
 * Integration-test bootstrap.
 *
 * These tests write to a real PostgreSQL database, so they require
 * TEST_DATABASE_URL to be set explicitly. There is deliberately no fallback to
 * DATABASE_URL: running the suite must never be able to touch a real pain log
 * because an environment variable happened to be set.
 *
 * See the README section "Running the tests" for how to prepare a database.
 */
const testUrl = process.env.TEST_DATABASE_URL;

if (testUrl) {
  // `src/lib/prisma` reads DATABASE_URL; point it at the throwaway database
  // before any test file imports it.
  process.env.DATABASE_URL = testUrl;
} else {
  console.warn(
    "\nTEST_DATABASE_URL is not set - database integration tests will be skipped.\n" +
      "See README > Running the tests.\n",
  );

  // The suites below are skipped, but importing them still loads the Prisma
  // client, which refuses to be constructed without a URL - deliberately, so a
  // misconfigured deployment fails at boot rather than at the first request.
  // This placeholder satisfies that check; nothing ever connects to it.
  process.env.DATABASE_URL ??=
    "postgresql://skipped:skipped@127.0.0.1:1/integration-tests-skipped";
}

export const hasTestDatabase = Boolean(testUrl);
