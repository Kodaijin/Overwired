#!/bin/sh
# Applies any pending database migrations, then starts the app.
#
# `migrate deploy` only applies migration files that already exist - it never
# generates one and never resets data, so it is safe to run on every start.
set -e

if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL is not set. Copy .env.example to .env and fill it in." >&2
  exit 1
fi

if [ -z "$AUTH_SECRET" ]; then
  echo "AUTH_SECRET is not set. Generate one with: openssl rand -base64 48" >&2
  exit 1
fi

# A bad TZ does not raise an error - the app just silently runs on the wrong
# clock, which is the exact failure this setting exists to prevent. Two ways it
# goes wrong, both checked here:
#
#   1. An unrecognised name ("Amerika/Los_Angeles") falls back to UTC.
#   2. An abbreviation is worse. `TZ=PST` runs at offset 0 while still
#      reporting itself as Pacific time - eight hours out, and it looks right.
#      Only a comparison of the real offset against the named zone's offset
#      catches that, so that is what this does.
if [ -n "$TZ" ]; then
  if ! node -e '
    const zone = process.env.TZ;
    let resolved;
    try {
      resolved = new Intl.DateTimeFormat("en-US", { timeZone: zone }).resolvedOptions().timeZone;
    } catch {
      console.error(`TZ is set to "${zone}", which is not a timezone Node recognises.`);
      process.exit(1);
    }
    // What the process actually runs on, versus what the named zone means.
    const probe = new Date();
    const actual = -probe.getTimezoneOffset();
    const label = new Intl.DateTimeFormat("en-US", { timeZone: resolved, timeZoneName: "longOffset" })
      .formatToParts(probe).find((p) => p.type === "timeZoneName").value;
    const match = /GMT([+-])(\d{2}):(\d{2})/.exec(label);
    const expected = match ? (match[1] === "-" ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3])) : 0;
    if (actual !== expected) {
      console.error(`TZ is set to "${zone}", which this container reads as UTC${actual >= 0 ? "+" : ""}${actual / 60} - not the ${resolved} it names (UTC${expected >= 0 ? "+" : ""}${expected / 60}).`);
      console.error(`Abbreviations like PST and EST do this. Use the full name: ${resolved}`);
      process.exit(1);
    }
  '; then
    echo "Fix TZ in .env, then start again. See README > Setting your timezone." >&2
    exit 1
  fi
fi
echo "Clock: $(node -e 'console.log(new Date().toString())')"

echo "Applying database migrations..."
node_modules/.bin/prisma migrate deploy

# This is the port inside the container, which is fixed. What the host
# publishes it as is APP_PORT - say so, because seeing 13000 here after
# setting APP_PORT to something else reads like the setting was ignored.
echo "Starting Overwired on container port ${PORT:-13000} (the host publishes it as APP_PORT)..."
exec "$@"
