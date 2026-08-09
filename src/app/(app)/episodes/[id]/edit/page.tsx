import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { EpisodeForm } from "@/components/episode-form";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth/user";
import { getEpisode } from "@/server/episodes";
import { getTaxonomy } from "@/server/taxonomy";

export const metadata: Metadata = { title: "Edit episode" };

export default async function EditEpisodePage(props: PageProps<"/episodes/[id]/edit">) {
  const { id } = await props.params;
  const user = await requireUser();

  const [episode, taxonomy] = await Promise.all([
    getEpisode(user.id, id),
    getTaxonomy(user.id),
  ]);

  if (!episode) notFound();

  // `getEpisode` returns the timeline in chronological order.
  const first = episode.measurements[0];
  const last = episode.measurements[episode.measurements.length - 1];

  // Only a reading taken at the end time counts as the level it ended at - an
  // episode ended without one has nothing to show here yet.
  const endSeverity =
    episode.endedAt && last && last.recordedAt.getTime() === episode.endedAt.getTime()
      ? last.severity
      : null;

  return (
    <>
      <PageHeader
        title="Edit episode"
        description="Correct the details of this episode, including the pain level it started and ended at. Readings from during the episode are edited on the episode page."
      />
      <EpisodeForm
        mode="edit"
        taxonomy={taxonomy}
        values={{
          id: episode.id,
          startedAt: episode.startedAt,
          endedAt: episode.endedAt,
          startSeverity: first?.severity ?? null,
          endSeverity,
          painType: episode.painType,
          description: episode.description,
          notes: episode.notes,
          locationIds: episode.locations.map((l) => l.location.id),
          characteristicIds: episode.characteristics.map((c) => c.characteristic.id),
          triggerIds: episode.triggers.map((t) => t.trigger.id),
          symptomIds: episode.symptoms.map((s) => s.symptom.id),
        }}
      />
    </>
  );
}
