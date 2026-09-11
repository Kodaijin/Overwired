# syntax=docker/dockerfile:1

# Multi-stage build.
#
# The runtime image carries the full production dependency tree rather than a
# Next.js standalone bundle. Standalone traces only what the *app* imports, but
# the container also runs `prisma migrate deploy` on start, and the Prisma CLI
# pulls in a dependency tree of its own that tracing does not see. Copying a
# hand-picked subset of it was fragile - a missing transitive module only
# showed up at container start. A production `npm ci` is a little larger and
# always correct.

FROM node:22-alpine AS base
# openssl is required by Prisma; libc6-compat covers glibc-linked binaries.
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# --- dependencies -----------------------------------------------------------
# The schema is copied before `npm ci` because the postinstall hook runs
# `prisma generate`, which needs it.
FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci

# --- build ------------------------------------------------------------------
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# No database is reachable at build time. Every page is rendered per request,
# so the build never queries one; this placeholder only satisfies the Prisma
# client constructor if a module-level import reaches it.
ENV DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build"
# The generated client lands in src/generated, which is not in the repo and is
# not carried over from the deps stage (only node_modules is), so it has to be
# generated here - the build imports it. It needs no database.
RUN node_modules/.bin/prisma generate
RUN npm run build

# --- production dependencies ------------------------------------------------
FROM base AS prod-deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci --omit=dev && npm cache clean --force

# --- runtime ----------------------------------------------------------------
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# The clock the app reads and displays times on. Override with `TZ` in .env.
# Named zones resolve through Node's bundled ICU data, so no `tzdata` package is
# needed - `docker compose exec app node -e "console.log(new Date().toString())"`
# confirms which zone is actually in force.
ENV TZ=America/Los_Angeles

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 --ingroup nodejs nextjs

COPY --from=prod-deps --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
# The build cache only speeds up rebuilds; it is dead weight at run time.
RUN rm -rf ./.next/cache
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/next.config.ts ./next.config.ts
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma.config.ts ./prisma.config.ts

COPY --chown=nextjs:nodejs docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/login').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node_modules/.bin/next", "start"]
