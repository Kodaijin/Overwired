"use client";

import { useCallback, useState } from "react";

import type { ActionResult } from "@/lib/errors";

/**
 * Runs a server action from a form and reports its result.
 *
 * This exists for forms that need to do something *after* a successful save -
 * clear their fields, close a dialog. Doing that by watching `useActionState`
 * from an effect means calling setState during render-commit, which causes
 * cascading renders; here the follow-up happens in the submit handler, which
 * is where an event response belongs.
 *
 * The trade-off is that these forms need JavaScript. Forms on the critical
 * path - signing in, recording an episode, filtering history - deliberately
 * stay on `useActionState` or plain GET so they work without it.
 */
export function useFormAction<T>(
  action: (
    previous: ActionResult<T> | null,
    formData: FormData,
  ) => Promise<ActionResult<T>>,
  onSuccess?: (data: T) => void,
): readonly [ActionResult<T> | null, (formData: FormData) => Promise<void>] {
  const [result, setResult] = useState<ActionResult<T> | null>(null);

  const submit = useCallback(
    async (formData: FormData) => {
      const next = await action(null, formData);
      setResult(next);
      if (next.ok) onSuccess?.(next.data);
    },
    [action, onSuccess],
  );

  return [result, submit] as const;
}
