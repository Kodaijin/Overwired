import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { PencilIcon, PillIcon } from "lucide-react";

import { ActivePainControls, ReopenEpisodeForm } from "@/components/active-pain-controls";
import { ConfirmDeleteForm } from "@/components/confirm-delete-form";
import { LiveDuration } from "@/components/live-duration";
import { PageHeader } from "@/components/page-header";
import { PainChart } from "@/components/pain-chart";
import { SeverityBadge } from "@/components/severity-badge";
import { TreatmentForm } from "@/components/treatment-form";
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
import { durationSeconds } from "@/lib/duration";
import { computeAggregates } from "@/lib/episode-metrics";
import { getEpisode } from "@/server/episodes";
import { getTaxonomy } from "@/server/taxonomy";
import {
  deleteEpisodeAction,
  deleteMeasurementAction,
  deleteTreatmentAction,
} from "@/server/actions/episodes";

export const metadata: Metadata = { title: "Episode" };

export default async function EpisodePage(props: PageProps<"/episodes/[id]">) {
  const { id } = await props.params;
  const user = await requireUser();

  const episode = await getEpisode(user.id, id);
  if (!episode) notFound();

  const taxonomy = await getTaxonomy(user.id);
  const aggregates = computeAggregates(episode.measurements);
  const ongoing = episode.endedAt == null;

  const chartPoints = episode.measurements.map((measurement) => ({
    time: measurement.recordedAt.getTime(),
    severity: measurement.severity,
    note: measurement.note,
  }));

  const chartMarkers = episode.treatments.map((treatment) => ({
    time: treatment.takenAt.getTime(),
    label: treatment.medicationName ?? treatment.treatmentType?.name ?? "Treatment",
  }));

  return (
    <>
      <PageHeader
        title={episode.painType || "Pain episode"}
        description={`Started ${format(episode.startedAt, "EEEE d MMMM yyyy 'at' HH:mm")}`}
        action={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={`/episodes/${episode.id}/edit`}>
                <PencilIcon aria-hidden="true" />
                Edit
              </Link>
            </Button>
            <ConfirmDeleteForm
              action={deleteEpisodeAction}
              hiddenFields={{ id: episode.id }}
              triggerLabel="Delete"
              title="Delete this episode?"
              description={`This removes the episode along with its ${episode.measurements.length} pain ${
                episode.measurements.length === 1 ? "reading" : "readings"
              } and ${episode.treatments.length} recorded ${
                episode.treatments.length === 1 ? "treatment" : "treatments"
              }. This cannot be undone.`}
              confirmLabel="Delete episode"
            />
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2">
                {ongoing ? (
                  <Badge variant="destructive">Ongoing</Badge>
                ) : (
                  <Badge variant="secondary">Ended</Badge>
                )}
                <LiveDuration
                  startedAt={episode.startedAt}
                  endedAt={episode.endedAt}
                  initialSeconds={durationSeconds(episode)}
                  className="text-2xl font-semibold tabular-nums"
                />
              </CardTitle>
              <CardDescription>
                {ongoing
                  ? "Still going - the elapsed time updates as you watch."
                  : `Ended ${format(episode.endedAt!, "EEEE d MMMM 'at' HH:mm")}`}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <SummaryStat label={ongoing ? "Right now" : "At the end"}>
                  <SeverityBadge severity={aggregates.currentSeverity} />
                </SummaryStat>
                <SummaryStat label="Peak">
                  <SeverityBadge severity={aggregates.peakSeverity} />
                </SummaryStat>
                <SummaryStat label="Lowest">
                  <SeverityBadge severity={aggregates.minSeverity} />
                </SummaryStat>
                <SummaryStat label="Average">
                  <span className="text-lg font-semibold tabular-nums">
                    {aggregates.averageSeverity ?? "-"}
                  </span>
                </SummaryStat>
              </dl>

              <PainChart points={chartPoints} markers={chartMarkers} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
              <CardDescription>
                Every reading and treatment, in the order they happened.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Timeline episode={episode} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Record a treatment</CardTitle>
              <CardDescription>
                What you tried, when, and whether it helped.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TreatmentForm
                episodeId={episode.id}
                treatmentTypes={taxonomy.treatmentTypes}
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {ongoing ? (
            <ActivePainControls
              episodeId={episode.id}
              currentSeverity={aggregates.currentSeverity}
            />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>This episode has ended</CardTitle>
                <CardDescription>
                  If the same pain came back, reopen it instead of starting a new
                  one.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ReopenEpisodeForm episodeId={episode.id} />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <TagList
                label="Locations"
                names={episode.locations.map((l) => l.location.name)}
              />
              <TagList
                label="Feels like"
                names={episode.characteristics.map((c) => c.characteristic.name)}
              />
              <TagList
                label="Possible triggers"
                names={episode.triggers.map((t) => t.trigger.name)}
              />
              <TagList
                label="Other symptoms"
                names={episode.symptoms.map((s) => s.symptom.name)}
              />

              {episode.description && (
                <div className="space-y-1">
                  <h3 className="text-muted-foreground font-medium">Description</h3>
                  <p className="whitespace-pre-wrap">{episode.description}</p>
                </div>
              )}
              {episode.notes && (
                <div className="space-y-1">
                  <h3 className="text-muted-foreground font-medium">Notes</h3>
                  <p className="whitespace-pre-wrap">{episode.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

function SummaryStat({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        {label}
      </dt>
      <dd>{children}</dd>
    </div>
  );
}

function TagList({ label, names }: { label: string; names: string[] }) {
  return (
    <div className="space-y-1">
      <h3 className="text-muted-foreground font-medium">{label}</h3>
      {names.length === 0 ? (
        <p className="text-muted-foreground">Not recorded</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {names.map((name) => (
            <li key={name}>
              <Badge variant="secondary">{name}</Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type EpisodeWithRelations = NonNullable<
  Awaited<ReturnType<typeof getEpisode>>
>;

/** Readings and treatments merged into one chronological list. */
function Timeline({ episode }: { episode: EpisodeWithRelations }) {
  const entries = [
    ...episode.measurements.map((measurement) => ({
      kind: "reading" as const,
      at: measurement.recordedAt,
      measurement,
    })),
    ...episode.treatments.map((treatment) => ({
      kind: "treatment" as const,
      at: treatment.takenAt,
      treatment,
    })),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());

  const canDeleteReadings = episode.measurements.length > 1;

  return (
    <ol className="space-y-3">
      {entries.map((entry) => (
        <li
          key={`${entry.kind}-${entry.kind === "reading" ? entry.measurement.id : entry.treatment.id}`}
          className="flex flex-wrap items-start gap-3 border-b pb-3 last:border-0 last:pb-0"
        >
          <time
            dateTime={entry.at.toISOString()}
            className="text-muted-foreground w-28 shrink-0 text-sm tabular-nums"
          >
            {format(entry.at, "d MMM HH:mm")}
          </time>

          {entry.kind === "reading" ? (
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              <SeverityBadge severity={entry.measurement.severity} />
              {entry.measurement.note && (
                <span className="text-muted-foreground min-w-0 text-sm">
                  {entry.measurement.note}
                </span>
              )}
              {canDeleteReadings && (
                <div className="ml-auto">
                  <ConfirmDeleteForm
                    action={deleteMeasurementAction}
                    hiddenFields={{
                      id: entry.measurement.id,
                      episodeId: episode.id,
                    }}
                    triggerLabel=""
                    triggerVariant="ghost"
                    triggerSize="icon-sm"
                    title="Remove this reading?"
                    description={`The ${entry.measurement.severity} out of 10 reading from ${format(
                      entry.measurement.recordedAt,
                      "d MMM 'at' HH:mm",
                    )} will be removed from the timeline.`}
                    confirmLabel="Remove reading"
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              <Badge variant="outline" className="gap-1">
                <PillIcon className="size-3" aria-hidden="true" />
                {entry.treatment.medicationName ??
                  entry.treatment.treatmentType?.name ??
                  "Treatment"}
              </Badge>
              {entry.treatment.dose && (
                <span className="text-muted-foreground text-sm">
                  {entry.treatment.dose}
                </span>
              )}
              {entry.treatment.effectiveness != null && (
                <span className="text-sm">
                  {entry.treatment.effectiveness}% relief
                </span>
              )}
              {entry.treatment.notes && (
                <span className="text-muted-foreground min-w-0 text-sm">
                  {entry.treatment.notes}
                </span>
              )}
              <div className="ml-auto">
                <ConfirmDeleteForm
                  action={deleteTreatmentAction}
                  hiddenFields={{ id: entry.treatment.id, episodeId: episode.id }}
                  triggerLabel=""
                  triggerVariant="ghost"
                  triggerSize="icon-sm"
                  title="Remove this treatment?"
                  description="This treatment will be removed from the episode's timeline."
                  confirmLabel="Remove treatment"
                />
              </div>
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}
