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

  return (
    <>
      <PageHeader
        title="Edit episode"
        description="Correct the details of this episode. Pain readings are edited from the episode page."
      />
      <EpisodeForm
        mode="edit"
        taxonomy={taxonomy}
        values={{
          id: episode.id,
          startedAt: episode.startedAt,
          endedAt: episode.endedAt,
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
