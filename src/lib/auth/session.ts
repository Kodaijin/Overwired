import { cookies, headers } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

/**
 * Sessions are a signed JWT in an httpOnly cookie.
 *
 * There is no server-side session table: for a self-hosted, single-household
 * app the extra round trip and cleanup job buy little. The trade-off is that
 * signing out only clears the cookie - to revoke every existing session,
 * rotate AUTH_SECRET.
 */

export const SESSION_COOKIE = "pt_session";

const MIN_SECRET_LENGTH = 32;

function sessionSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;

  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `AUTH_SECRET must be set to at least ${MIN_SECRET_LENGTH} characters. ` +
        "Generate one with: openssl rand -base64 48",
    );
  }

  return new TextEncoder().encode(secret);
}

function sessionDays(): number {
  const parsed = Number.parseInt(process.env.SESSION_DAYS ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 365) return 30;
  return parsed;
}

/**
 * Marks the cookie `Secure` when the request actually arrived over HTTPS.
 *
 * Hard-coding `secure: true` in production would silently break plain-HTTP LAN
 * deployments (the browser would refuse to send the cookie and every login
 * would appear to fail), so this follows the real protocol, honouring the
 * forwarded header set by a reverse proxy.
 */
async function isSecureRequest(): Promise<boolean> {
  const headerList = await headers();
  const forwardedProto = headerList.get("x-forwarded-proto");
  if (forwardedProto) {
    return forwardedProto.split(",")[0].trim() === "https";
  }
  return false;
}

export async function createSession(userId: string): Promise<void> {
  const maxAgeSeconds = sessionDays() * 24 * 60 * 60;

  const token = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${sessionDays()}d`)
    .sign(sessionSecret());

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: await isSecureRequest(),
    path: "/",
    maxAge: maxAgeSeconds,
  });
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

/**
 * Returns the signed-in user's id, or null when there is no valid session.
 *
 * A malformed or expired token is treated exactly like "not signed in" - it is
 * never an error the user has to see.
 */
export async function getSessionUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, sessionSecret(), {
      algorithms: ["HS256"],
    });
    return typeof payload.sub === "string" && payload.sub.length > 0
      ? payload.sub
      : null;
  } catch {
    return null;
  }
}
