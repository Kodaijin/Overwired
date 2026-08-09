import type { Metadata } from "next";
import Link from "next/link";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  parse,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon } from "lucide-react";

import { EmptyState, EpisodeCard } from "@/components/episode-card";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/user";
import { endOfDay, startOfDay } from "@/lib/filters";
import { severityColorClasses, severityDescription } from "@/lib/pain-scale";
import { loadAllMeasurements } from "@/server/analytics";
import { getEpisodesInRange } from "@/server/episodes";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Calendar" };

export default async function CalendarPage(props: PageProps<"/calendar">) {
  const user = await requireUser();
  const searchParams = await props.searchParams;

  const month = parseMonth(first(searchParams.month));
  const selectedDay = parseDay(first(searchParams.day));

  const gridStart = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });

  const [episodes, measurements] = await Promise.all([
    getEpisodesInRange(user.id, gridStart, gridEnd),
    loadAllMeasurements(user.id, gridStart, gridEnd),
  ]);

  // Highest reading per day drives the cell's colour and label.
  const peakByDay = new Map<string, number>();
  for (const measurement of measurements) {
    const key = format(measurement.recordedAt, "yyyy-MM-dd");
    peakByDay.set(key, Math.max(peakByDay.get(key) ?? 0, measurement.severity));
  }

  // An episode spanning several days is counted on each of them.
  const countByDay = new Map<string, number>();
  for (const episode of episodes) {
    const from = episode.startedAt < gridStart ? gridStart : episode.startedAt;
    const to = episode.endedAt == null || episode.endedAt > gridEnd ? gridEnd : episode.endedAt;
    if (to < from) continue;
    for (const day of eachDayOfInterval({ start: startOfDay(from), end: startOfDay(to) })) {
      const key = format(day, "yyyy-MM-dd");
      countByDay.set(key, (countByDay.get(key) ?? 0) + 1);
    }
  }

  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const selectedEpisodes = selectedDay
    ? episodes.filter((episode) => {
        const dayStart = startOfDay(selectedDay);
        const dayEnd = endOfDay(selectedDay);
        return (
          episode.startedAt <= dayEnd &&
          (episode.endedAt == null || episode.endedAt >= dayStart)
        );
      })
    : [];

  const monthKey = (value: Date) => format(value, "yyyy-MM");

  return (
    <>
      <PageHeader
        title="Calendar"
        description="Days with recorded pain. Choose a day to see its episodes."
        action={
          <Button asChild>
            <Link href="/episodes/new">
              <PlusIcon aria-hidden="true" />
              Record pain
            </Link>
          </Button>
        }
      />

      <div className="mb-4 flex items-center justify-between gap-2">
        <Button asChild variant="outline" size="icon">
          <Link
            href={`/calendar?month=${monthKey(subMonths(month, 1))}`}
            aria-label={`Go to ${format(subMonths(month, 1), "MMMM yyyy")}`}
          >
            <ChevronLeftIcon aria-hidden="true" />
          </Link>
        </Button>

        <h2 className="text-lg font-semibold">{format(month, "MMMM yyyy")}</h2>

        <Button asChild variant="outline" size="icon">
          <Link
            href={`/calendar?month=${monthKey(addMonths(month, 1))}`}
            aria-label={`Go to ${format(addMonths(month, 1), "MMMM yyyy")}`}
          >
            <ChevronRightIcon aria-hidden="true" />
          </Link>
        </Button>
      </div>

      <table className="w-full table-fixed border-separate border-spacing-1">
        <caption className="sr-only">
          Pain calendar for {format(month, "MMMM yyyy")}. Each day shows the
          highest pain level recorded that day.
        </caption>
        <thead>
          <tr>
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label) => (
              <th
                key={label}
                scope="col"
                className="text-muted-foreground pb-1 text-xs font-medium"
              >
                <span aria-hidden="true">{label.slice(0, 1)}</span>
                <span className="sr-only">{label}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {chunk(days, 7).map((week) => (
            <tr key={week[0].toISOString()}>
              {week.map((day) => {
                const key = format(day, "yyyy-MM-dd");
                const peak = peakByDay.get(key);
                const count = countByDay.get(key) ?? 0;
                const outside = !isSameMonth(day, month);
                const selected = selectedDay != null && isSameDay(day, selectedDay);

                return (
                  <td key={key} className="p-0 align-top">
                    <Link
                      href={`/calendar?month=${monthKey(month)}&day=${key}`}
                      aria-current={selected ? "date" : undefined}
                      className={cn(
                        "focus-visible:ring-ring flex aspect-square flex-col items-center justify-center gap-0.5 rounded-lg border text-sm transition-colors focus-visible:ring-3 focus-visible:outline-none",
                        outside && "opacity-40",
                        peak != null ? severityColorClasses(peak) : "hover:bg-muted",
                        selected && "ring-foreground ring-2",
                        isToday(day) && "border-foreground",
                      )}
                    >
                      <span className="font-medium tabular-nums">
                        {format(day, "d")}
                      </span>
                      {peak != null && (
                        <span className="text-[0.65rem] tabular-nums" aria-hidden="true">
                          {peak}/10
                        </span>
                      )}
                      <span className="sr-only">
                        {format(day, "d MMMM yyyy")}.{" "}
                        {peak != null
                          ? `Highest ${severityDescription(peak)}. ${count} ${
                              count === 1 ? "episode" : "episodes"
                            }.`
                          : "No pain recorded."}
                      </span>
                    </Link>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <section aria-live="polite" className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">
          {selectedDay
            ? format(selectedDay, "EEEE d MMMM yyyy")
            : "Choose a day above"}
        </h2>

        {selectedDay == null ? (
          <p className="text-muted-foreground text-sm">
            Selecting a day shows every episode that was happening on it,
            including ones that started earlier.
          </p>
        ) : selectedEpisodes.length === 0 ? (
          <EmptyState
            title="No pain recorded on this day"
            description="Nothing was logged, and no episode from an earlier day was still running."
          >
            <Button asChild variant="outline">
              <Link href="/episodes/new">Record pain</Link>
            </Button>
          </EmptyState>
        ) : (
          <ul className="space-y-3">
            {selectedEpisodes.map((episode) => (
              <EpisodeCard key={episode.id} episode={episode} />
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Falls back to the current month when the parameter is missing or malformed. */
function parseMonth(value: string | undefined): Date {
  if (!value) return startOfMonth(new Date());
  const parsed = parse(value, "yyyy-MM", new Date());
  return Number.isNaN(parsed.getTime()) ? startOfMonth(new Date()) : startOfMonth(parsed);
}

function parseDay(value: string | undefined): Date | null {
  if (!value) return null;
  const parsed = parse(value, "yyyy-MM-dd", new Date());
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}
