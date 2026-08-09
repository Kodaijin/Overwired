import { cn } from "@/lib/utils";

/**
 * A single headline number.
 *
 * `hint` carries the qualifier that keeps the number honest - what period it
 * covers, or what it is a mean of.
 */
export function StatTile({
  label,
  value,
  hint,
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border p-4", className)}>
      <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        {label}
      </dt>
      <dd className="mt-1 text-2xl font-semibold tabular-nums">{value}</dd>
      {hint && <p className="text-muted-foreground mt-1 text-xs">{hint}</p>}
    </div>
  );
}

/** A ranked list with proportional bars, e.g. most common locations. */
export function RankedList({
  items,
  emptyMessage = "Nothing recorded yet.",
  limit = 5,
}: {
  items: readonly { name: string; count: number }[];
  emptyMessage?: string;
  limit?: number;
}) {
  if (items.length === 0) {
    return <p className="text-muted-foreground text-sm">{emptyMessage}</p>;
  }

  const max = Math.max(...items.map((item) => item.count));

  return (
    <ol className="space-y-2">
      {items.slice(0, limit).map((item) => (
        <li key={item.name} className="space-y-1">
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="truncate">{item.name}</span>
            <span className="text-muted-foreground shrink-0 tabular-nums">
              {item.count}
            </span>
          </div>
          <div
            className="bg-muted h-1.5 overflow-hidden rounded-full"
            aria-hidden="true"
          >
            <div
              className="bg-primary h-full rounded-full"
              style={{ width: `${Math.round((item.count / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ol>
  );
}
