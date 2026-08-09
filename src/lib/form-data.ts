/**
 * Readers for `FormData`.
 *
 * Every value arrives as a string (or is absent). These helpers normalise that
 * into the shapes the Zod schemas expect, without doing any validation of their
 * own - a blank field becomes `undefined` so the schema decides whether it was
 * required.
 */

export function text(formData: FormData, name: string): string | undefined {
  const value = formData.get(name);
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

export function number(formData: FormData, name: string): number | undefined {
  const raw = text(formData, name);
  if (raw == null) return undefined;
  const parsed = Number(raw);
  // NaN is passed through so the schema reports "must be a number" rather than
  // this silently dropping the field.
  return Number.isNaN(parsed) ? Number.NaN : parsed;
}

/** Repeated fields, e.g. a column of checkboxes sharing one name. */
export function list(formData: FormData, name: string): string[] {
  return formData
    .getAll(name)
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

/** Unchecked checkboxes are absent from FormData entirely. */
export function boolean(formData: FormData, name: string): boolean {
  const value = formData.get(name);
  return value === "on" || value === "true" || value === "1";
}
