"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";
import {
  SEVERITY_VALUES,
  severityColorClasses,
  severityDescription,
  severityLabel,
} from "@/lib/pain-scale";

/**
 * The primary severity control.
 *
 * Eleven buttons rather than a slider: entering pain should be one tap, and a
 * slider needs aim and a drag. It is a radio group, so arrow keys move between
 * values and screen readers announce "7 out of 10 - Severe".
 */
export function SeverityPicker({
  name,
  defaultValue,
  label = "Pain level",
  required = true,
}: {
  name: string;
  defaultValue?: number | null;
  label?: string;
  required?: boolean;
}) {
  const [value, setValue] = useState<number | null>(defaultValue ?? null);

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm leading-none font-medium">
        {label}
        {!required && (
          <span className="text-muted-foreground font-normal"> (optional)</span>
        )}
      </legend>

      {/* The chosen value travels with the form; the buttons drive it. */}
      <input type="hidden" name={name} value={value ?? ""} />

      <div
        role="radiogroup"
        aria-label={label}
        aria-required={required}
        className="grid grid-cols-6 gap-1.5 sm:grid-cols-11"
      >
        {SEVERITY_VALUES.map((severity) => {
          const selected = value === severity;
          return (
            <button
              key={severity}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={severityDescription(severity)}
              // Roving tabindex: the group is one tab stop, arrows move within.
              tabIndex={selected || (value == null && severity === 0) ? 0 : -1}
              onClick={() => setValue(severity)}
              onKeyDown={(event) => {
                const delta =
                  event.key === "ArrowRight" || event.key === "ArrowDown"
                    ? 1
                    : event.key === "ArrowLeft" || event.key === "ArrowUp"
                      ? -1
                      : 0;
                if (delta === 0) return;
                event.preventDefault();
                const next = Math.min(10, Math.max(0, (value ?? 0) + delta));
                setValue(next);
                const group = event.currentTarget.parentElement;
                const target = group?.children[next];
                if (target instanceof HTMLElement) target.focus();
              }}
              className={cn(
                "focus-visible:ring-ring flex h-12 items-center justify-center rounded-lg border text-base font-semibold tabular-nums transition-colors focus-visible:ring-3 focus-visible:outline-none",
                selected
                  ? cn(severityColorClasses(severity), "border-foreground ring-foreground/20 ring-2")
                  : "border-border hover:bg-muted",
              )}
            >
              {severity}
            </button>
          );
        })}
      </div>

      <p aria-live="polite" className="text-muted-foreground min-h-5 text-sm">
        {value == null ? "Tap a number from 0 to 10." : `${value}/10 - ${severityLabel(value)}`}
      </p>
    </fieldset>
  );
}
