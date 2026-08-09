import { compare, hash } from "bcryptjs";

/**
 * bcrypt work factor. 12 keeps a single hash in the ~250ms range on typical
 * self-hosting hardware, which is a reasonable trade for a login form.
 */
const COST = 12;

export function hashPassword(plain: string): Promise<string> {
  return hash(plain, COST);
}

export function verifyPassword(plain: string, passwordHash: string): Promise<boolean> {
  return compare(plain, passwordHash);
}
