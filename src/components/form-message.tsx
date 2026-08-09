import { AlertCircleIcon, CheckCircle2Icon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { ActionResult } from "@/lib/errors";

/**
 * Renders the outcome of a server action.
 *
 * `role="alert"` and `aria-live` mean the message is announced when it appears
 * rather than only being visible, and the icon plus wording carry the meaning
 * without relying on colour.
 */
export function FormMessage({
  result,
  successMessage,
}: {
  result: ActionResult<unknown> | null;
  successMessage?: string;
}) {
  if (!result) return null;

  if (result.ok) {
    if (!successMessage) return null;
    return (
      <Alert role="status" aria-live="polite">
        <CheckCircle2Icon aria-hidden="true" />
        <AlertTitle>{successMessage}</AlertTitle>
      </Alert>
    );
  }

  const detailedErrors = Object.entries(result.fieldErrors ?? {});

  return (
    <Alert variant="destructive" role="alert" aria-live="assertive">
      <AlertCircleIcon aria-hidden="true" />
      <AlertTitle>{result.message}</AlertTitle>
      {detailedErrors.length > 0 && (
        <AlertDescription>
          <ul className="list-disc space-y-1 pl-4">
            {detailedErrors.slice(0, 25).map(([field, messages]) => (
              <li key={field}>
                <span className="font-medium">{field}:</span> {messages.join(", ")}
              </li>
            ))}
            {detailedErrors.length > 25 && (
              <li>...and {detailedErrors.length - 25} more.</li>
            )}
          </ul>
        </AlertDescription>
      )}
    </Alert>
  );
}

/** Inline, field-level error text tied to an input via `aria-describedby`. */
export function FieldError({
  id,
  messages,
}: {
  id: string;
  messages: string[] | undefined;
}) {
  if (!messages || messages.length === 0) return null;

  return (
    <p id={id} className="text-destructive text-sm" role="alert">
      {messages.join(". ")}
    </p>
  );
}
