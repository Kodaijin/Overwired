"use client";

import Link from "next/link";
import { useActionState } from "react";

import { DateTimeField } from "@/components/datetime-field";
import { FormMessage } from "@/components/form-message";
import { SeverityPicker } from "@/components/severity-picker";
import { SubmitButton } from "@/components/submit-button";
import { TaxonomyChips } from "@/components/taxonomy-chips";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/lib/errors";
import type { Taxonomy } from "@/server/taxonomy";
import { createEpisodeAction, updateEpisodeAction } from "@/server/actions/episodes";

export interface EpisodeFormValues {
  id: string;
  startedAt: Date;
  endedAt: Date | null;
  painType: string | null;
  description: string | null;
  notes: string | null;
  locationIds: string[];
  characteristicIds: string[];
  triggerIds: string[];
  symptomIds: string[];
}

/**
 * One form for both recording and editing an episode.
 *
 * The fields are ordered by how urgently they are needed while in pain -
 * location, level, then character. Everything else lives behind "More details"
 * so a new episode can be recorded in two taps and filled in later.
 */
export function EpisodeForm({
  taxonomy,
  values,
  mode,
}: {
  taxonomy: Taxonomy;
  values?: EpisodeFormValues;
  mode: "create" | "edit";
}) {
  const action = mode === "create" ? createEpisodeAction : updateEpisodeAction;
  const [result, formAction] = useActionState<ActionResult<undefined> | null, FormData>(
    action,
    null,
  );

  const active = <T extends { archived: boolean }>(items: readonly T[]) =>
    items.filter((item) => !item.archived);

  return (
    <form action={formAction} className="space-y-6">
      {values && <input type="hidden" name="id" value={values.id} />}

      <FormMessage
        result={result}
        successMessage={mode === "edit" ? "Changes saved." : undefined}
      />

      <Card>
        <CardContent className="space-y-6">
          <TaxonomyChips
            name="locationIds"
            legend="Where is the pain?"
            options={active(taxonomy.locations).map((location) => ({
              id: location.id,
              label: location.name,
              depth: location.depth,
            }))}
            selectedIds={values?.locationIds}
          />

          {mode === "create" ? (
            <SeverityPicker name="severity" label="How bad is it right now?" />
          ) : (
            <p className="text-muted-foreground text-sm">
              Pain levels are kept as a timeline. Add or remove readings from the
              episode page rather than editing them here.
            </p>
          )}

          <TaxonomyChips
            name="characteristicIds"
            legend="What does it feel like?"
            options={active(taxonomy.characteristics).map((item) => ({
              id: item.id,
              label: item.name,
            }))}
            selectedIds={values?.characteristicIds}
          />

          <DateTimeField
            id="startedAt"
            name="startedAt"
            label="When did it start?"
            defaultValue={values?.startedAt}
            defaultToNow={mode === "create"}
            required
          />
        </CardContent>
      </Card>

      <details
        className="group rounded-xl border"
        open={mode === "edit"}
      >
        <summary className="hover:bg-muted cursor-pointer rounded-xl px-4 py-3 text-sm font-medium select-none">
          More details
          <span className="text-muted-foreground font-normal">
            {" "}
            - triggers, symptoms, notes
          </span>
        </summary>

        <div className="space-y-6 border-t px-4 py-5">
          <TaxonomyChips
            name="triggerIds"
            legend="What might have set it off?"
            options={active(taxonomy.triggers).map((item) => ({
              id: item.id,
              label: item.name,
            }))}
            selectedIds={values?.triggerIds}
          />

          <TaxonomyChips
            name="symptomIds"
            legend="Anything else happening alongside it?"
            options={active(taxonomy.symptoms).map((item) => ({
              id: item.id,
              label: item.name,
            }))}
            selectedIds={values?.symptomIds}
          />

          <div className="space-y-2">
            <Label htmlFor="painType">
              Label{" "}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input
              id="painType"
              name="painType"
              defaultValue={values?.painType ?? ""}
              placeholder="e.g. migraine, flare-up, post-exercise"
            />
            <p className="text-muted-foreground text-sm">
              A short name for this kind of episode, so you can group and filter
              by it later.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">
              Description{" "}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Textarea
              id="description"
              name="description"
              rows={3}
              defaultValue={values?.description ?? ""}
              placeholder="In your own words - what it feels like, what makes it better or worse."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">
              Notes{" "}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Textarea
              id="notes"
              name="notes"
              rows={3}
              defaultValue={values?.notes ?? ""}
              placeholder="Anything you want to remember or mention at an appointment."
            />
          </div>

          <DateTimeField
            id="endedAt"
            name="endedAt"
            label="When did it end?"
            defaultValue={values?.endedAt}
            hint="Leave this empty while the pain is still going."
          />
        </div>
      </details>

      <div className="flex flex-wrap gap-2">
        <SubmitButton size="lg" pendingLabel="Saving...">
          {mode === "create" ? "Start tracking" : "Save changes"}
        </SubmitButton>
        <Button asChild variant="ghost" size="lg">
          <Link href={values ? `/episodes/${values.id}` : "/"}>Cancel</Link>
        </Button>
      </div>
    </form>
  );
}
