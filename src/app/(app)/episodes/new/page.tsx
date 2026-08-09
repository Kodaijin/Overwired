import type { Metadata } from "next";

import { EpisodeForm } from "@/components/episode-form";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth/user";
import { getTaxonomy } from "@/server/taxonomy";

export const metadata: Metadata = { title: "Record pain" };

export default async function NewEpisodePage() {
  const user = await requireUser();
  const taxonomy = await getTaxonomy(user.id);

  return (
    <>
      <PageHeader
        title="Record pain"
        description="Only the location and pain level are needed to start. You can fill in the rest at any time."
      />
      <EpisodeForm taxonomy={taxonomy} mode="create" />
    </>
  );
}
