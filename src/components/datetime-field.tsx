"use client";

import { useEffect, useRef } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * A `datetime-local` field.
 *
 * When `defaultToNow` is set the value is filled in after mount rather than
 * during render: the server does not know the browser's timezone, so rendering
 * a time on the server would either be wrong or cause a hydration mismatch.
 *
 * The submitted value has no timezone (`2024-03-01T14:30`), which the server
 * reads as local time - the time the user actually meant.
 */
export function DateTimeField({
  id,
  name,
  label,
  defaultValue,
  defaultToNow = false,
  hint,
  required,
}: {
  id: string;
  name: string;
  label: string;
  defaultValue?: Date | string | null;
  defaultToNow?: boolean;
  hint?: string;
  required?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  // The input is uncontrolled and the value is written straight to the DOM:
  // syncing with the browser is what an effect is for, and it avoids a state
  // update during commit.
  useEffect(() => {
    if (defaultValue || !defaultToNow) return;
    const input = inputRef.current;
    // Never overwrite something the user has already typed.
    if (input && input.value === "") {
      input.value = toDateTimeLocal(new Date());
    }
  }, [defaultValue, defaultToNow]);

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label}
        {!required && (
          <span className="text-muted-foreground font-normal"> (optional)</span>
        )}
      </Label>
      <Input
        ref={inputRef}
        id={id}
        name={name}
        type="datetime-local"
        defaultValue={defaultValue ? toDateTimeLocal(new Date(defaultValue)) : ""}
        required={required}
        aria-describedby={hint ? `${id}-hint` : undefined}
      />
      {hint && (
        <p id={`${id}-hint`} className="text-muted-foreground text-sm">
          {hint}
        </p>
      )}
    </div>
  );
}

/** `Date` -> `YYYY-MM-DDTHH:mm` in local time, which is what the input wants. */
export function toDateTimeLocal(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}
