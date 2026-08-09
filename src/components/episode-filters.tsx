import Link from "next/link";
import { FilterXIcon, SearchIcon } from "lucide-react";

import { TaxonomyChips } from "@/components/taxonomy-chips";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SEVERITY_VALUES } from "@/lib/pain-scale";
import { hasActiveFilters } from "@/lib/filters";
import type { EpisodeFilter } from "@/lib/schemas";
import type { Taxonomy } from "@/server/taxonomy";

/**
 * Filter controls for the history page.
 *
 * A plain GET form: the filter state lives in the URL, so results are
 * shareable and bookmarkable, the back button behaves, and the whole thing
 * works with JavaScript disabled. Field names match the query keys that
 * `parseEpisodeFilter` reads.
 */
export function EpisodeFilters({
  filter,
  taxonomy,
  resultCount,
}: {
  filter: EpisodeFilter;
  taxonomy: Taxonomy;
  resultCount: number;
}) {
  const active = hasActiveFilters(filter);
  const activeItems = <T extends { archived: boolean }>(items: readonly T[]) =>
    items.filter((item) => !item.archived);

  return (
    <form method="get" action="/episodes" className="mb-6 space-y-4 rounded-xl border p-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="q">Search descriptions and notes</Label>
          <Input
            id="q"
            name="q"
            type="search"
            defaultValue={filter.search ?? ""}
            placeholder="e.g. burning, after work"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="from">From</Label>
          <Input
            id="from"
            name="from"
            type="date"
            defaultValue={toDateValue(filter.from)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="to">To</Label>
          <Input id="to" name="to" type="date" defaultValue={toDateValue(filter.to)} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <select
            id="status"
            name="status"
            defaultValue={filter.status}
            className="border-input bg-background focus-visible:ring-ring h-9 w-full rounded-lg border px-3 text-sm focus-visible:ring-3 focus-visible:outline-none"
          >
            <option value="all">All episodes</option>
            <option value="active">Ongoing only</option>
            <option value="completed">Ended only</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="minSeverity">Peak severity at least</Label>
          <SeveritySelect
            id="minSeverity"
            name="minSeverity"
            value={filter.minSeverity ?? null}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="maxSeverity">Peak severity at most</Label>
          <SeveritySelect
            id="maxSeverity"
            name="maxSeverity"
            value={filter.maxSeverity ?? null}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="painType">Label</Label>
          <Input
            id="painType"
            name="painType"
            defaultValue={filter.painType ?? ""}
            placeholder="e.g. migraine"
          />
        </div>
      </div>

      <details className="rounded-lg border" open={hasTagFilters(filter)}>
        <summary className="hover:bg-muted cursor-pointer rounded-lg px-3 py-2 text-sm font-medium select-none">
          Filter by location, feel, trigger, symptom or treatment
        </summary>
        <div className="space-y-5 border-t px-3 py-4">
          <TaxonomyChips
            name="loc"
            legend="Locations"
            options={activeItems(taxonomy.locations).map((l) => ({
              id: l.id,
              label: l.name,
              depth: l.depth,
            }))}
            selectedIds={filter.locationIds}
          />
          <TaxonomyChips
            name="char"
            legend="Feels like"
            options={activeItems(taxonomy.characteristics).map((c) => ({
              id: c.id,
              label: c.name,
            }))}
            selectedIds={filter.characteristicIds}
          />
          <TaxonomyChips
            name="trig"
            legend="Triggers"
            options={activeItems(taxonomy.triggers).map((t) => ({
              id: t.id,
              label: t.name,
            }))}
            selectedIds={filter.triggerIds}
          />
          <TaxonomyChips
            name="symp"
            legend="Symptoms"
            options={activeItems(taxonomy.symptoms).map((s) => ({
              id: s.id,
              label: s.name,
            }))}
            selectedIds={filter.symptomIds}
          />
          <TaxonomyChips
            name="treat"
            legend="Treatments used"
            options={activeItems(taxonomy.treatmentTypes).map((t) => ({
              id: t.id,
              label: t.name,
            }))}
            selectedIds={filter.treatmentTypeIds}
          />
        </div>
      </details>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="lg">
          <SearchIcon aria-hidden="true" />
          Apply filters
        </Button>

        {active && (
          <Button asChild variant="ghost" size="lg">
            <Link href="/episodes">
              <FilterXIcon aria-hidden="true" />
              Clear
            </Link>
          </Button>
        )}

        <p aria-live="polite" className="text-muted-foreground ml-auto text-sm">
          {resultCount} {resultCount === 1 ? "episode" : "episodes"} match
          {active ? " these filters" : ""}
        </p>
      </div>
    </form>
  );
}

function SeveritySelect({
  id,
  name,
  value,
}: {
  id: string;
  name: string;
  value: number | null;
}) {
  return (
    <select
      id={id}
      name={name}
      defaultValue={value == null ? "" : String(value)}
      className="border-input bg-background focus-visible:ring-ring h-9 w-full rounded-lg border px-3 text-sm focus-visible:ring-3 focus-visible:outline-none"
    >
      <option value="">Any</option>
      {SEVERITY_VALUES.map((severity) => (
        <option key={severity} value={severity}>
          {severity}
        </option>
      ))}
    </select>
  );
}

function hasTagFilters(filter: EpisodeFilter): boolean {
  return (
    filter.locationIds.length > 0 ||
    filter.characteristicIds.length > 0 ||
    filter.triggerIds.length > 0 ||
    filter.symptomIds.length > 0 ||
    filter.treatmentTypeIds.length > 0
  );
}

function toDateValue(date: Date | null): string {
  if (!date) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
