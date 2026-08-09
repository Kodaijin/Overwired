import type { Metadata } from "next";
import Link from "next/link";
import { subDays } from "date-fns";

import { PageHeader } from "@/components/page-header";
import { RankedList, StatTile } from "@/components/stat-tile";
import { TrendChart } from "@/components/trend-chart";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireUser } from "@/lib/auth/user";
import { formatDuration } from "@/lib/duration";
import { averageByPeriod, computeStatistics, type Period } from "@/lib/statistics";
import { loadAllMeasurements, loadStatsEpisodes } from "@/server/analytics";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Statistics" };

const RANGES = [
  { key: "30", label: "30 days", days: 30 },
  { key: "90", label: "90 days", days: 90 },
  { key: "365", label: "12 months", days: 365 },
  { key: "all", label: "All time", days: null },
] as const;

const PERIODS: { key: Period; label: string }[] = [
  { key: "day", label: "Daily" },
  { key: "week", label: "Weekly" },
  { key: "month", label: "Monthly" },
];

export default async function StatisticsPage(props: PageProps<"/statistics">) {
  const user = await requireUser();
  const searchParams = await props.searchParams;

  const range =
    RANGES.find((option) => option.key === first(searchParams.range)) ?? RANGES[0];
  const period =
    PERIODS.find((option) => option.key === first(searchParams.period))?.key ?? "day";

  const now = new Date();
  const since = range.days == null ? undefined : subDays(now, range.days);

  const [episodes, measurements] = await Promise.all([
    loadStatsEpisodes(user.id),
    loadAllMeasurements(user.id, since),
  ]);

  // Episode-level statistics use only episodes that overlap the window.
  const inRange = since
    ? episodes.filter(
        (episode) => episode.endedAt == null || episode.endedAt >= since,
      )
    : episodes;

  const stats = computeStatistics(inRange, now);
  const series = averageByPeriod(measurements, period);

  return (
    <>
      <PageHeader
        title="Statistics"
        description="Summaries of what you have recorded."
      />

      <div className="mb-6 flex flex-wrap gap-4">
        <ToggleRow
          label="Period"
          options={RANGES.map((option) => ({ key: option.key, label: option.label }))}
          selected={range.key}
          hrefFor={(key) => `/statistics?range=${key}&period=${period}`}
        />
        <ToggleRow
          label="Averaged by"
          options={PERIODS.map((option) => ({ key: option.key, label: option.label }))}
          selected={period}
          hrefFor={(key) => `/statistics?range=${range.key}&period=${key}`}
        />
      </div>

      {stats.episodeCount === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="font-medium">Nothing recorded in this period</p>
            <p className="text-muted-foreground mt-1 text-sm">
              Try a longer period, or record an episode to get started.
            </p>
            <Button asChild className="mt-4">
              <Link href="/episodes/new">Record pain</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile label="Episodes" value={stats.episodeCount} />
            <StatTile
              label="Average pain"
              value={stats.averageSeverity ?? "-"}
              hint={`Mean of ${stats.measurementCount} readings`}
            />
            <StatTile
              label="Highest recorded"
              value={stats.highestSeverity != null ? `${stats.highestSeverity}/10` : "-"}
            />
            <StatTile
              label="Lowest recorded"
              value={stats.lowestSeverity != null ? `${stats.lowestSeverity}/10` : "-"}
            />
            <StatTile
              label="Total time in pain"
              value={formatDuration(stats.totalDurationSeconds)}
              hint="Ongoing episodes counted up to now"
            />
            <StatTile
              label="Average episode"
              value={
                stats.averageDurationSeconds != null
                  ? formatDuration(stats.averageDurationSeconds)
                  : "-"
              }
            />
            <StatTile
              label="Longest episode"
              value={
                stats.longestEpisode
                  ? formatDuration(stats.longestEpisode.durationSeconds)
                  : "-"
              }
              hint={stats.longestEpisode ? "See it in History" : undefined}
            />
            <StatTile
              label="Ongoing now"
              value={stats.activeCount}
            />
          </dl>

          <Card>
            <CardHeader>
              <CardTitle>Average pain over time</CardTitle>
              <CardDescription>
                The mean of the readings in each {period}. Periods with no
                readings are left out rather than shown as zero.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {series.length > 1 ? (
                <TrendChart points={series} />
              ) : (
                <p className="text-muted-foreground text-sm">
                  Not enough readings in this period to draw a trend.
                </p>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Locations</CardTitle>
              </CardHeader>
              <CardContent>
                <RankedList items={stats.topLocations} limit={8} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Characteristics</CardTitle>
              </CardHeader>
              <CardContent>
                <RankedList items={stats.topCharacteristics} limit={8} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recorded triggers</CardTitle>
                <CardDescription>
                  How often you noted each alongside an episode.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <RankedList items={stats.topTriggers} limit={8} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Associated symptoms</CardTitle>
              </CardHeader>
              <CardContent>
                <RankedList items={stats.topSymptoms} limit={8} />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Treatments</CardTitle>
              <CardDescription>
                How often each was used, and the average of the relief scores you
                entered.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {stats.treatmentEffectiveness.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No treatments recorded in this period.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Treatment</TableHead>
                      <TableHead className="text-right">Times used</TableHead>
                      <TableHead className="text-right">Rated</TableHead>
                      <TableHead className="text-right">Average relief</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.treatmentEffectiveness.map((treatment) => (
                      <TableRow key={treatment.name}>
                        <TableCell className="font-medium">{treatment.name}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {treatment.uses}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {treatment.rated}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {treatment.averageEffectiveness != null
                            ? `${treatment.averageEffectiveness}%`
                            : "Not rated"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Alert>
            <AlertTitle>These are summaries of your own entries</AlertTitle>
            <AlertDescription>
              They describe what you recorded and nothing more. Things that
              appear together here are not evidence that one caused the other,
              and none of this is a substitute for talking to a clinician.
            </AlertDescription>
          </Alert>
        </div>
      )}
    </>
  );
}

function ToggleRow({
  label,
  options,
  selected,
  hrefFor,
}: {
  label: string;
  options: readonly { key: string; label: string }[];
  selected: string;
  hrefFor: (key: string) => string;
}) {
  return (
    <div className="space-y-1">
      <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        {label}
      </p>
      <div className="flex flex-wrap gap-1">
        {options.map((option) => (
          <Button
            key={option.key}
            asChild
            variant={option.key === selected ? "default" : "outline"}
            size="sm"
          >
            <Link
              href={hrefFor(option.key)}
              aria-current={option.key === selected ? "true" : undefined}
              className={cn(option.key === selected && "font-semibold")}
            >
              {option.label}
            </Link>
          </Button>
        ))}
      </div>
    </div>
  );
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
