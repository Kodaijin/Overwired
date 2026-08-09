import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * Prisma CLI configuration.
 *
 * The URL is read straight from `process.env` rather than through Prisma's
 * `env()` helper: `env()` throws when the variable is missing, which breaks
 * `prisma generate` during a Docker build, where no database exists yet and
 * none is needed. Commands that do need a connection (`migrate deploy`) run at
 * container start, by which point DATABASE_URL is set.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
