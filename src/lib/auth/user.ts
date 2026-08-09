import { redirect } from "next/navigation";
import { cache } from "react";

import { prisma } from "@/lib/prisma";
import { seedDefaultTaxonomy } from "@/lib/taxonomy";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { getSessionUserId } from "@/lib/auth/session";

export interface CurrentUser {
  id: string;
  email: string;
  name: string | null;
}

/**
 * The signed-in user, or null.
 *
 * `cache` de-duplicates the lookup across the layout, the page and any server
 * component in a single render pass.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const userId = await getSessionUserId();
  if (!userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true },
  });

  // The token was valid but the account is gone (deleted, or restored from a
  // backup taken before it existed).
  return user ?? null;
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function userCount(): Promise<number> {
  return prisma.user.count();
}

/**
 * The first account can always be created - otherwise a fresh install would be
 * unusable. After that, registration is closed unless ALLOW_REGISTRATION is on.
 */
export async function isRegistrationOpen(): Promise<boolean> {
  if (process.env.ALLOW_REGISTRATION === "true") return true;
  return (await userCount()) === 0;
}

export type RegisterResult =
  | { ok: true; userId: string }
  | { ok: false; error: "email-taken" | "registration-closed" };

export async function registerUser(input: {
  email: string;
  password: string;
  name: string | null;
}): Promise<RegisterResult> {
  if (!(await isRegistrationOpen())) {
    return { ok: false, error: "registration-closed" };
  }

  const existing = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true },
  });
  if (existing) return { ok: false, error: "email-taken" };

  const passwordHash = await hashPassword(input.password);

  try {
    const userId = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email: input.email, passwordHash, name: input.name },
        select: { id: true },
      });
      await seedDefaultTaxonomy(tx, user.id);
      return user.id;
    });

    return { ok: true, userId };
  } catch (error) {
    // Two simultaneous registrations for the same address: the unique index
    // decides, and the loser reports it as a taken address.
    if (isUniqueViolation(error)) return { ok: false, error: "email-taken" };
    throw error;
  }
}

/**
 * Verifies credentials. Returns null for both "no such account" and "wrong
 * password" so the response cannot be used to enumerate registered addresses.
 */
export async function authenticate(
  email: string,
  password: string,
): Promise<CurrentUser | null> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true, passwordHash: true },
  });

  if (!user) {
    // Spend comparable time on a dummy hash so response timing does not reveal
    // whether the address exists.
    await verifyPassword(password, DUMMY_HASH);
    return null;
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) return null;

  return { id: user.id, email: user.email, name: user.name };
}

/** A real bcrypt hash of a value nobody can supply. */
const DUMMY_HASH = "$2a$12$C6UzMDM.H6dfI/f/IKcEe.7WgUgpVGjLtLmhoNIVFtc3D5tHDIVpu";

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}
