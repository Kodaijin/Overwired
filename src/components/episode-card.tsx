import Link from "next/link";
import { format } from "date-fns";

import { LiveDuration } from "@/components/live-duration";
import { durationSeconds } from "@/lib/duration";
import { SeverityBadge } from "@/components/severity-badge";
import { Badge } from "@/components/ui/badge";
import type { EpisodeListItem } from "@/server/episodes";

/**
 * One episode in a list.
 *
 * The whole card is a single link, with the status and severity readable
 * without opening it.
 */
export function EpisodeCard({ episode }: { episode: EpisodeListItem }) {
  const ongoing = episode.endedAt == null;
  const locations = episode.locations.map((l) => l.location.name);
  const characteristics = episode.characteristics.map((c) => c.characteristic.name);

  return (
    <li>
      <Link
        href={`/episodes/${episode.id}`}
        className="hover:bg-muted/50 focus-visible:ring-ring block rounded-xl border p-4 transition-colors focus-visible:ring-3 focus-visible:outline-none"
      >
        <div className="flex flex-wrap items-center gap-2">
          <SeverityBadge severity={ongoing ? episode.currentSeverity : episode.peakSeverity} />

          {ongoing ? (
            <Badge variant="destructive">Ongoing</Badge>
          ) : (
            <span className="text-muted-foreground text-sm">
              Peak {episode.peakSeverity ?? "-"}/10
            </span>
          )}

          <span className="text-muted-foreground ml-auto text-sm tabular-nums">
            <LiveDuration
              startedAt={episode.startedAt}
              endedAt={episode.endedAt}
              initialSeconds={durationSeconds(episode)}
            />
          </span>
        </div>

        <p className="mt-2 font-medium">
          {episode.painType || locations.join(", ") || "Pain episode"}
        </p>

        <p className="text-muted-foreground text-sm">
          <time dateTime={episode.startedAt.toISOString()}>
            {format(episode.startedAt, "EEE d MMM yyyy, HH:mm")}
          </time>
          {locations.length > 0 && episode.painType ? ` - ${locations.join(", ")}` : ""}
        </p>

        {characteristics.length > 0 && (
          <p className="text-muted-foreground mt-1 text-sm">
            {characteristics.slice(0, 4).join(", ")}
            {characteristics.length > 4 ? ` +${characteristics.length - 4} more` : ""}
          </p>
        )}
      </Link>
    </li>
  );
}

export function EmptyState({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed p-8 text-center">
      <p className="font-medium">{title}</p>
      <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-sm text-balance">
        {description}
      </p>
      {children && <div className="mt-4 flex justify-center">{children}</div>}
    </div>
  );
}
