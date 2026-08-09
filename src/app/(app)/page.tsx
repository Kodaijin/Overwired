import Link from "next/link";
import { format, subDays } from "date-fns";
import { PlusIcon } from "lucide-react";

import { EmptyState, EpisodeCard } from "@/components/episode-card";
import { LiveDuration } from "@/components/live-duration";
import { PageHeader } from "@/components/page-header";
import { SeverityBadge } from "@/components/severity-badge";
import { RankedList, StatTile } from "@/components/stat-tile";
import { TrendChart } from "@/components/trend-chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireUser } from "@/lib/auth/user";
import { durationSeconds, formatDuration } from "@/lib/duration";
import { episodeFilterSchema } from "@/lib/schemas";
import { averageByPeriod, computeStatistics, severityTrend } from "@/lib/statistics";
import { loadAllMeasurements, loadStatsEpisodes } from "@/server/analytics";
import { getActiveEpisodes, getRecentEpisodes } from "@/server/episodes";

/** Rolling window used for the dashboard's headline numbers. */
const WINDOW_DAYS = 30;

export default async function DashboardPage() {
  const user = await requireUser();
  const now = new Date();
  const windowStart = subDays(now, WINDOW_DAYS);

  const [active, recent, windowEpisodes, windowMeasurements] = await Promise.all([
    getActiveEpisodes(user.id),
    getRecentEpisodes(user.id, 5),
    loadStatsEpisodes(
      user.id,
      episodeFilterSchema.parse({ from: windowStart, to: now }),
    ),
    loadAllMeasurements(user.id, windowStart),
  ]);

  const stats = computeStatistics(windowEpisodes, now);
  const trend = severityTrend(windowMeasurements, 7, now);
  const dailyAverages = averageByPeriod(windowMeasurements, "day");

  const hasAnyData = recent.length > 0;

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`Your pain activity over the last ${WINDOW_DAYS} days.`}
        action={
          <Button asChild size="lg">
            <Link href="/episodes/new">
              <PlusIcon aria-hidden="true" />
              Record pain
            </Link>
          </Button>
        }
      />

      {!hasAnyData ? (
        <EmptyState
          title="Nothing recorded yet"
          description="Start your first episode when pain begins. You only need a location and a level - everything else can wait."
        >
          <Button asChild size="lg">
            <Link href="/episodes/new">
              <PlusIcon aria-hidden="true" />
              Record pain
            </Link>
          </Button>
        </EmptyState>
      ) : (
        <div className="space-y-6">
          {active.length > 0 && (
            <section aria-labelledby="active-heading">
              <h2 id="active-heading" className="mb-3 text-lg font-semibold">
                Happening now
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {active.map((episode) => {
                  const locations = episode.locations.map((l) => l.location.name);
                  return (
                    <Card key={episode.id} className="border-destructive/40">
                      <CardHeader>
                        <CardTitle className="flex flex-wrap items-center gap-2">
                          <Badge variant="destructive">Ongoing</Badge>
                          <SeverityBadge severity={episode.currentSeverity} />
                        </CardTitle>
                        <CardDescription>
                          {episode.painType || locations.join(", ") || "Pain episode"} -
                          started {format(episode.startedAt, "HH:mm 'on' d MMM")}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="flex flex-wrap items-center gap-3">
                        <p className="text-2xl font-semibold tabular-nums">
                          <LiveDuration
                            startedAt={episode.startedAt}
                            initialSeconds={durationSeconds(episode, now)}
                          />
                        </p>
                        <Button asChild className="ml-auto">
                          <Link href={`/episodes/${episode.id}`}>Update pain level</Link>
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </section>
          )}

          <section aria-labelledby="summary-heading">
            <h2 id="summary-heading" className="mb-3 text-lg font-semibold">
              Last {WINDOW_DAYS} days
            </h2>
            <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatTile
                label="Episodes"
                value={stats.episodeCount}
                hint={
                  stats.activeCount > 0 ? `${stats.activeCount} still ongoing` : undefined
                }
              />
              <StatTile
                label="Average pain"
                value={stats.averageSeverity ?? "-"}
                hint={`Mean of ${stats.measurementCount} readings`}
              />
              <StatTile
                label="Highest pain"
                value={stats.highestSeverity != null ? `${stats.highestSeverity}/10` : "-"}
              />
              <StatTile
                label="Time in pain"
                value={formatDuration(stats.totalDurationSeconds)}
                hint="Total across all episodes"
              />
            </dl>
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Daily average pain</CardTitle>
                <CardDescription>
                  {trend.change == null
                    ? "The mean of each day's readings. Days with no readings are left out."
                    : `Last 7 days averaged ${trend.current}, against ${trend.previous} the week before.`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {dailyAverages.length > 1 ? (
                  <TrendChart points={dailyAverages} />
                ) : (
                  <p className="text-muted-foreground text-sm">
                    Not enough readings yet to draw a trend.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent episodes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <ul className="space-y-3">
                  {recent.map((episode) => (
                    <EpisodeCard key={episode.id} episode={episode} />
                  ))}
                </ul>
                <Button asChild variant="outline" className="w-full">
                  <Link href="/episodes">See all episodes</Link>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Most common locations</CardTitle>
                <CardDescription>
                  How often each was recorded in this period.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <RankedList items={stats.topLocations} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>How it felt</CardTitle>
                <CardDescription>
                  The characteristics recorded most often.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <RankedList items={stats.topCharacteristics} />
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
