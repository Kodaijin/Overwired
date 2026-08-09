import type { Metadata } from "next";
import Link from "next/link";
import { DownloadIcon, PlusIcon } from "lucide-react";

import { EmptyState, EpisodeCard } from "@/components/episode-card";
import { EpisodeFilters } from "@/components/episode-filters";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/user";
import {
  episodeFilterToSearchParams,
  hasActiveFilters,
  parseEpisodeFilter,
} from "@/lib/filters";
import { listEpisodes } from "@/server/episodes";
import { getTaxonomy } from "@/server/taxonomy";

export const metadata: Metadata = { title: "History" };

export default async function EpisodesPage(props: PageProps<"/episodes">) {
  const user = await requireUser();
  const searchParams = await props.searchParams;
  const filter = parseEpisodeFilter(searchParams);

  const [{ episodes, total, pageCount }, taxonomy] = await Promise.all([
    listEpisodes(user.id, filter),
    getTaxonomy(user.id),
  ]);

  const filtered = hasActiveFilters(filter);

  // Carry the current filter through to the export so what you see is what you
  // download.
  const exportQuery = episodeFilterToSearchParams({ ...filter, page: 1 });
  exportQuery.set("format", "csv");

  return (
    <>
      <PageHeader
        title="History"
        description="Every episode you have recorded, newest first."
        action={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={`/api/export?${exportQuery.toString()}`} prefetch={false}>
                <DownloadIcon aria-hidden="true" />
                Export these
              </Link>
            </Button>
            <Button asChild>
              <Link href="/episodes/new">
                <PlusIcon aria-hidden="true" />
                Record pain
              </Link>
            </Button>
          </div>
        }
      />

      <EpisodeFilters filter={filter} taxonomy={taxonomy} resultCount={total} />

      {episodes.length === 0 ? (
        <EmptyState
          title={filtered ? "No episodes match these filters" : "No episodes yet"}
          description={
            filtered
              ? "Try widening the date range or clearing some filters."
              : "Your recorded episodes will appear here."
          }
        >
          <Button asChild>
            <Link href={filtered ? "/episodes" : "/episodes/new"}>
              {filtered ? "Clear filters" : "Record pain"}
            </Link>
          </Button>
        </EmptyState>
      ) : (
        <>
          <ul className="space-y-3">
            {episodes.map((episode) => (
              <EpisodeCard key={episode.id} episode={episode} />
            ))}
          </ul>

          {pageCount > 1 && (
            <nav
              aria-label="Pagination"
              className="mt-6 flex items-center justify-between gap-2"
            >
              <PageLink filter={filter} page={filter.page - 1} disabled={filter.page <= 1}>
                Previous
              </PageLink>
              <p className="text-muted-foreground text-sm" aria-current="page">
                Page {filter.page} of {pageCount}
              </p>
              <PageLink
                filter={filter}
                page={filter.page + 1}
                disabled={filter.page >= pageCount}
              >
                Next
              </PageLink>
            </nav>
          )}
        </>
      )}
    </>
  );
}

function PageLink({
  filter,
  page,
  disabled,
  children,
}: {
  filter: ReturnType<typeof parseEpisodeFilter>;
  page: number;
  disabled: boolean;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <Button variant="outline" disabled>
        {children}
      </Button>
    );
  }

  const params = episodeFilterToSearchParams({ ...filter, page });

  return (
    <Button asChild variant="outline">
      <Link href={`/episodes?${params.toString()}`}>{children}</Link>
    </Button>
  );
}
