import { z } from "zod";

/**
 * Result type returned by every server action.
 *
 * Actions never throw at the UI. They return either data or a message that is
 * safe to render - raw database or stack output must not reach the browser.
 */
export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]> };

export function actionOk(): ActionResult<undefined>;
export function actionOk<T>(data: T): ActionResult<T>;
export function actionOk<T>(data?: T): ActionResult<T | undefined> {
  return { ok: true, data };
}

export function actionError(
  message: string,
  fieldErrors?: Record<string, string[]>,
): ActionResult<never> {
  return { ok: false, message, fieldErrors };
}

/**
 * Turns a Zod failure into per-field messages the form can render inline.
 *
 * Issues are grouped by their top-level path segment, which is the form field
 * name. Issues with an empty path belong to the form as a whole.
 */
export function validationError(error: z.ZodError<unknown>): ActionResult<never> {
  const fieldErrors: Record<string, string[]> = {};
  const formErrors: string[] = [];

  for (const issue of error.issues) {
    const field = issue.path[0];
    if (typeof field === "string") {
      (fieldErrors[field] ??= []).push(issue.message);
    } else {
      formErrors.push(issue.message);
    }
  }

  const message =
    formErrors[0] ??
    Object.values(fieldErrors)[0]?.[0] ??
    "Please check the highlighted fields and try again.";

  return { ok: false, message, fieldErrors };
}

export const GENERIC_ERROR_MESSAGE =
  "Something went wrong saving that. Your data was not changed - please try again.";

/**
 * Logs enough to debug a failure without writing health information to disk.
 *
 * Error *messages* are deliberately omitted: Prisma echoes offending values
 * back in validation errors, and in this app those values are pain
 * descriptions, notes and symptoms. The error class, its code and the stack
 * identify the failing code path; the offending data stays in the database.
 */
export function logServerError(context: string, error: unknown): void {
  const name = error instanceof Error ? error.name : typeof error;
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code)
      : undefined;
  const location =
    error instanceof Error && error.stack
      ? error.stack.split("\n").slice(1, 4).join(" | ").trim()
      : "no stack";

  console.error(
    `[${context}] ${name}${code ? ` (code ${code})` : ""} at ${location}`,
  );
}

/**
 * Wraps an action body so any unexpected throw becomes a safe message.
 *
 * Next.js signals `redirect()` and `notFound()` by throwing, so those are
 * re-thrown rather than swallowed.
 */
export async function withActionErrorHandling<T>(
  context: string,
  fn: () => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  try {
    return await fn();
  } catch (error) {
    if (isNextControlFlowError(error)) throw error;
    logServerError(context, error);
    return actionError(GENERIC_ERROR_MESSAGE);
  }
}

function isNextControlFlowError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    /^NEXT_(REDIRECT|NOT_FOUND|HTTP_ERROR_FALLBACK)/.test(
      (error as { digest: string }).digest,
    )
  );
}
