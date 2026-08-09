# Pain Tracker

A self-hosted web app for recording pain episodes and the symptoms, triggers and
treatments around them, then seeing how they change over time.

It is built around the idea that pain is not one thing. Episodes can overlap,
each has its own location, character and severity, and severity is recorded as
an **append-only timeline** rather than a single number that gets overwritten —
so the history of an episode stays intact and can be graphed.

Everything runs in Docker on your own machine. There are no third-party
services, no analytics, and no AI dependency.

> This is a tracking and visualisation tool. It does not diagnose anything, and
> nothing it shows is medical advice. Patterns in the charts are patterns in
> what you entered — not evidence that one thing caused another.

---

## Contents

1. [Requirements](#1-requirements)
2. [Environment variables](#2-environment-variables)
3. [Initial setup](#3-initial-setup)
4. [Starting the application](#4-starting-the-application)
5. [Database migrations](#5-database-migrations)
6. [Creating the first user](#6-creating-the-first-user)
7. [Updating the application](#7-updating-the-application)
8. [Backing up the database](#8-backing-up-the-database)
9. [Restoring the database](#9-restoring-the-database)
10. [Development](#10-development)
11. [Running the tests](#11-running-the-tests)
12. [How it is put together](#12-how-it-is-put-together)
13. [Privacy and security notes](#13-privacy-and-security-notes)

---

## 1. Requirements

- Docker Engine 24+ with the Compose plugin (`docker compose version`)
- About 2 GB of free disk for the image and database

For development outside Docker you also need Node.js 20.9+ (22 LTS
recommended) and npm 10+.

---

## 2. Environment variables

Copy the example file and edit it:

```bash
cp .env.example .env
```

| Variable | Required | Default | What it does |
| --- | --- | --- | --- |
| `POSTGRES_USER` | no | `pain` | Database user created on first start. |
| `POSTGRES_PASSWORD` | **yes** | — | Database password. Change it before exposing anything. |
| `POSTGRES_DB` | no | `paintracker` | Database name. |
| `DATABASE_URL` | **yes** | — | Connection string. Inside Compose the host is `db`. |
| `AUTH_SECRET` | **yes** | — | Signs session cookies. At least 32 characters. |
| `SESSION_DAYS` | no | `30` | How long a session stays valid. |
| `ALLOW_REGISTRATION` | no | `false` | Whether `/register` is open. The **first** account can always be created regardless. |
| `APP_PORT` | no | `3000` | Host port the app is published on. |
| `DB_PORT` | no | `5432` | Host port the database is published on (loopback only). |

Generate a secret with:

```bash
openssl rand -base64 48
```

The app refuses to start without `DATABASE_URL` and `AUTH_SECRET`, rather than
running with an insecure default.

---

## 3. Initial setup

```bash
cp .env.example .env
# edit .env: set POSTGRES_PASSWORD and AUTH_SECRET, and put the same
# password into DATABASE_URL
```

That is the whole setup. The database schema is created automatically the first
time the app container starts.

---

## 4. Starting the application

```bash
docker compose up -d
```

Then open <http://localhost:3000>.

On start the app container applies any pending migrations and then serves the
app. Watch it come up with:

```bash
docker compose logs -f app
```

To stop it:

```bash
docker compose down          # keeps your data
docker compose down -v       # DELETES the database volume as well
```

**Both ports are published on `127.0.0.1` only.** The app is reachable from the
machine it runs on and nowhere else. To reach it from other devices, put a
reverse proxy with HTTPS in front of it (Caddy, nginx, Traefik) and point that
at `127.0.0.1:3000`. Session cookies are marked `Secure` automatically when the
proxy forwards `X-Forwarded-Proto: https`.

---

## 5. Database migrations

Migrations live in `prisma/migrations/` and are committed to the repository.

- **In Docker:** applied automatically on every container start, by
  `docker-entrypoint.sh` running `prisma migrate deploy`. That command only
  applies migration files that already exist — it never generates one and never
  resets data.
- **Manually:**

  ```bash
  docker compose exec app npx prisma migrate deploy
  docker compose exec app npx prisma migrate status   # what is pending
  ```

- **Creating a new one** after changing `prisma/schema.prisma` (development
  only):

  ```bash
  npm run db:migrate -- --name describe_your_change
  ```

---

## 6. Creating the first user

Registration is closed by default (`ALLOW_REGISTRATION=false`), **except** when
the database has no accounts yet. So on a fresh install:

1. Go to <http://localhost:3000/register>
2. Create your account — it is marked as the first account on the server.
3. After that, `/register` is closed again automatically.

Every new account is seeded with a full set of default locations, pain
characteristics, triggers, symptoms and treatments, which you can rename, add
to or archive under **Settings**.

### Additional accounts, or a forgotten password

Run the account script on the host, pointing at the same database. The Compose
database is published on `127.0.0.1:5432` for exactly this:

```bash
# .env must have a DATABASE_URL with host `localhost` for host-side commands:
# DATABASE_URL=postgresql://pain:yourpassword@localhost:5432/paintracker?schema=public
npm install          # once
npm run create-user
```

It prompts for an email and password, and offers to reset the password if the
account already exists. Resetting a password does not end existing sessions —
to do that, change `AUTH_SECRET` and restart.

Alternatively set `ALLOW_REGISTRATION=true` in `.env`, restart, register, then
set it back to `false`.

---

## 7. Updating the application

```bash
git pull
docker compose build
docker compose up -d
```

New migrations are applied automatically as the container starts. Take a backup
first (next section) — that is the only rollback path for a schema change.

---

## 8. Backing up the database

The database lives in the named Docker volume `pgdata`, which survives
`docker compose down` and image rebuilds. It does **not** survive
`docker compose down -v`.

Take a real backup regularly:

```bash
mkdir -p backups
docker compose exec -T db pg_dump -U pain -d paintracker --clean --if-exists \
  > "backups/paintracker-$(date +%F).sql"
```

Compressed:

```bash
docker compose exec -T db pg_dump -U pain -d paintracker --clean --if-exists \
  | gzip > "backups/paintracker-$(date +%F).sql.gz"
```

You can also export your records from the **Data** page as JSON — that file is
human-readable, portable, and can be imported back into a fresh install. Keep
both: the SQL dump restores the exact database, the JSON survives it.

`backups/` is git-ignored. It contains your health data — treat it accordingly.

---

## 9. Restoring the database

Restoring **overwrites the current contents**. Make sure you want to.

```bash
# 1. Stop the app so nothing writes while restoring
docker compose stop app

# 2. Load the dump
docker compose exec -T db psql -U pain -d paintracker < backups/paintracker-2024-03-01.sql

# 3. Apply any migrations newer than the dump, then start
docker compose start app
```

For a compressed dump:

```bash
gunzip -c backups/paintracker-2024-03-01.sql.gz \
  | docker compose exec -T db psql -U pain -d paintracker
```

Starting completely fresh:

```bash
docker compose down -v      # destroys the volume
docker compose up -d        # recreates an empty schema
```

---

## 10. Development

Run PostgreSQL in Docker and the app on your machine, for fast refresh:

```bash
cp .env.example .env
# for host-side work, DATABASE_URL should use `localhost`, not `db`:
# DATABASE_URL=postgresql://pain:devpassword@localhost:5432/paintracker?schema=public

docker compose -f docker-compose.dev.yml up -d   # database only
npm install
npm run db:migrate                               # create/apply schema
npm run dev
```

Useful scripts:

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run typecheck` | Route type generation + `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | Unit tests |
| `npm run check` | Typecheck, lint and unit tests together |
| `npm run db:migrate` | Create and apply a migration |
| `npm run db:studio` | Prisma Studio, a database browser |
| `npm run create-user` | Create an account or reset a password |

---

## 11. Running the tests

Unit tests cover the calculations, validation and file formats, and need
nothing but Node:

```bash
npm test
```

The integration tests exercise the real data layer — creating episodes,
appending severity readings, ending and reopening, editing, deleting, filtering
and importing — against a real PostgreSQL. They only run when
`TEST_DATABASE_URL` is set, and there is **no fallback to `DATABASE_URL`**, so
the suite can never touch your real pain log.

Point it at a throwaway database:

```bash
docker compose -f docker-compose.dev.yml up -d

docker compose -f docker-compose.dev.yml exec -T db \
  psql -U pain -d paintracker -c "CREATE DATABASE paintracker_test;"

TEST_DATABASE_URL="postgresql://pain:devpassword@localhost:5432/paintracker_test?schema=public" \
  npx prisma migrate deploy

TEST_DATABASE_URL="postgresql://pain:devpassword@localhost:5432/paintracker_test?schema=public" \
  npm run test:db
```

---

## 12. How it is put together

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 ·
shadcn/ui · PostgreSQL 17 · Prisma 7 · Zod 4 · Recharts · Vitest.

```
prisma/schema.prisma      Database schema and migrations
src/app/(auth)/           Sign in and registration
src/app/(app)/            Dashboard, history, calendar, statistics, data, settings
src/app/api/export/       CSV and JSON download
src/components/           UI components (src/components/ui is shadcn/ui)
src/lib/                  Pure domain logic: severity, duration, statistics,
                          validation, filters, export/import formats, auth
src/server/               Database access
src/server/actions/       Server actions (authenticate, validate, delegate)
src/proxy.ts              Routing guard for signed-out visitors
tests/unit/               Pure logic tests
tests/integration/        Data-layer tests against real PostgreSQL
```

A few decisions worth knowing about:

**Severity is append-only.** Updating the pain level during an episode inserts a
new `PainMeasurement`; it never edits an old one. Peak, minimum, current and
duration are *derived* from those rows. They are cached on the episode row so
that filtering and sorting can happen in SQL, and they are recomputed from
scratch by a single function after any write that could affect them, so the
cache cannot drift.

**Corrections are separate from changes over time.** Editing an episode can fix
the pain level it started and ended at — those are the two readings you are most
likely to have mistyped, and they are corrected in place rather than by
appending a contradictory reading at the same instant. Readings from *during* an
episode are only added and removed on the episode page, so the edit form cannot
be used to quietly flatten how the pain actually moved.

**Taxonomy is owned per user.** Locations, characteristics, triggers, symptoms
and treatment types are seeded per account rather than shared globally. That
makes built-in and custom entries behave identically — you can rename or
archive anything without special cases. Entries are archived, never deleted, so
an old episode keeps its labels.

**Treatments are recorded one row per thing tried.** Responding to pain is
rarely a single action, so several treatments can be entered in one submission —
but each is stored separately, with its own time, dose and effectiveness. Rolled
into one entry they could not answer "was it the ibuprofen or the lying down?".
The whole submission is written in one transaction, so a rejected row leaves
nothing half-recorded.

**Date filters use overlap, not containment.** An episode that started before
the range and is still going *is* happening during the range, so it matches.
Filtering on the start time alone would hide exactly the long episodes most
worth seeing.

**Gaps in tracking are not drawn as zero pain.** Periods with no readings are
left out of the charts rather than plotted at zero, because "I did not record
anything" and "I had no pain" are different things.

**Authentication** is a signed JWT in an `httpOnly` cookie (`jose`), with
passwords hashed using bcrypt. There is no session table: for a personal
instance the extra round trip is not worth it. The trade-off is that signing
out only clears the cookie — to invalidate every session everywhere, rotate
`AUTH_SECRET` and restart.

The runtime image carries the full production dependency tree (~1.5 GB) rather
than a slimmer traced bundle. The container applies migrations on start, which
needs the Prisma CLI and its dependencies; hand-picking those out of the tree
turned out to break at container start when a transitive module was missed, and
a correct deployment is worth more than the disk.

### Not in this version

Built so they can be added without reworking the schema: a visual body-map
picker, PDF/print reports, multiple users per instance, attachments, reminders,
and optional AI summaries. The `EpisodeLink` table exists for relating episodes
to each other but has no UI yet.

---

## 13. Privacy and security notes

- **Nothing leaves your server.** No analytics, no telemetry, no third-party
  requests, no AI provider. Next.js telemetry is disabled in the image.
- **Health data is kept out of the logs.** Error logging deliberately records
  the error class, code and stack location but *not* error messages, because
  database errors quote the offending values — which here are pain
  descriptions, notes and symptoms. Prisma query logging is off for the same
  reason.
- **The UI never shows raw errors.** Server actions return plain messages;
  stack traces and database errors stay server-side.
- **Search engines are told not to index the app**, and export responses are
  marked `no-store` so no shared cache retains them.
- **All ports bind to loopback by default.** Serve it over HTTPS through a
  reverse proxy before letting anything else reach it.
- **Registration is closed by default** once the first account exists.
- Passwords must be at least 10 characters. There are no composition rules — a
  long passphrase is stronger and easier to remember.
- Sign-in failures are deliberately identical for "no such account" and "wrong
  password", including in how long they take, so the form cannot be used to
  discover which email addresses are registered.

---

## Licence

Provided as-is for personal use.
