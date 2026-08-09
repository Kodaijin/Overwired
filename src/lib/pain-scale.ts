/**
 * The 0-10 pain scale.
 *
 * Every place that shows a severity must show the number and the word, never
 * colour alone - colour is an extra cue, not the message.
 */

export const MIN_SEVERITY = 0;
export const MAX_SEVERITY = 10;

export type SeverityBand =
  | "none"
  | "very-mild"
  | "mild"
  | "moderate"
  | "severe"
  | "very-severe"
  | "worst";

interface BandDefinition {
  band: SeverityBand;
  label: string;
  /** Inclusive range on the 0-10 scale. */
  min: number;
  max: number;
}

const BANDS: readonly BandDefinition[] = [
  { band: "none", label: "No pain", min: 0, max: 0 },
  { band: "very-mild", label: "Very mild", min: 1, max: 2 },
  { band: "mild", label: "Mild", min: 3, max: 4 },
  { band: "moderate", label: "Moderate", min: 5, max: 6 },
  { band: "severe", label: "Severe", min: 7, max: 8 },
  { band: "very-severe", label: "Very severe", min: 9, max: 9 },
  { band: "worst", label: "Worst imaginable", min: 10, max: 10 },
];

export function isValidSeverity(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= MIN_SEVERITY &&
    value <= MAX_SEVERITY
  );
}

export function severityBand(severity: number): SeverityBand {
  return severityBandDefinition(severity).band;
}

/** Human-readable label, e.g. `7` -> `"Severe"`. */
export function severityLabel(severity: number): string {
  return severityBandDefinition(severity).label;
}

/** Screen-reader and tooltip friendly, e.g. `"7 out of 10 - Severe"`. */
export function severityDescription(severity: number): string {
  return `${severity} out of 10 - ${severityLabel(severity)}`;
}

function severityBandDefinition(severity: number): BandDefinition {
  const clamped = clampSeverity(severity);
  const match = BANDS.find((b) => clamped >= b.min && clamped <= b.max);
  // The bands cover 0-10 exhaustively, so this is unreachable in practice.
  return match ?? BANDS[0];
}

export function clampSeverity(severity: number): number {
  if (!Number.isFinite(severity)) return MIN_SEVERITY;
  return Math.min(MAX_SEVERITY, Math.max(MIN_SEVERITY, Math.round(severity)));
}

/**
 * Tailwind classes per band. Each band also has a distinct label and, in the
 * charts, a distinct marker, so this is never the only differentiator.
 */
export function severityColorClasses(severity: number): string {
  switch (severityBand(severity)) {
    case "none":
      return "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100";
    case "very-mild":
      return "bg-emerald-100 text-emerald-950 dark:bg-emerald-950 dark:text-emerald-100";
    case "mild":
      return "bg-lime-100 text-lime-950 dark:bg-lime-950 dark:text-lime-100";
    case "moderate":
      return "bg-amber-100 text-amber-950 dark:bg-amber-950 dark:text-amber-100";
    case "severe":
      return "bg-orange-100 text-orange-950 dark:bg-orange-950 dark:text-orange-100";
    case "very-severe":
      return "bg-red-100 text-red-950 dark:bg-red-950 dark:text-red-100";
    case "worst":
      return "bg-red-200 text-red-950 dark:bg-red-900 dark:text-red-50";
  }
}

/** Solid colour used for chart marks. */
export function severityChartColor(severity: number): string {
  switch (severityBand(severity)) {
    case "none":
      return "var(--color-slate-400)";
    case "very-mild":
      return "var(--color-emerald-500)";
    case "mild":
      return "var(--color-lime-500)";
    case "moderate":
      return "var(--color-amber-500)";
    case "severe":
      return "var(--color-orange-500)";
    case "very-severe":
      return "var(--color-red-500)";
    case "worst":
      return "var(--color-red-700)";
  }
}

export const SEVERITY_VALUES: readonly number[] = Array.from(
  { length: MAX_SEVERITY - MIN_SEVERITY + 1 },
  (_, i) => MIN_SEVERITY + i,
);

/** Distinct bands with their ranges, for legends and pickers. */
export const SEVERITY_BANDS = BANDS;
