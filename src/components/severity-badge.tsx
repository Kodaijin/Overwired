import { cn } from "@/lib/utils";
import {
  severityColorClasses,
  severityDescription,
  severityLabel,
} from "@/lib/pain-scale";

/**
 * A severity reading.
 *
 * Always shows the number, and by default the band name too. Colour is a third
 * cue on top of those, never the only one.
 */
export function SeverityBadge({
  severity,
  showLabel = true,
  className,
}: {
  severity: number | null | undefined;
  showLabel?: boolean;
  className?: string;
}) {
  if (severity == null) {
    return (
      <span
        className={cn(
          "text-muted-foreground inline-flex items-center rounded-md border border-dashed px-2 py-0.5 text-sm",
          className,
        )}
      >
        No reading
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-sm font-medium tabular-nums",
        severityColorClasses(severity),
        className,
      )}
    >
      <span aria-hidden="true">{severity}/10</span>
      {showLabel && (
        <span aria-hidden="true" className="font-normal">
          {severityLabel(severity)}
        </span>
      )}
      <span className="sr-only">{severityDescription(severity)}</span>
    </span>
  );
}
