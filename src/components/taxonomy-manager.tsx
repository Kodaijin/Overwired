"use client";

import { useActionState, useCallback, useRef, useState } from "react";
import { ArchiveIcon, PencilIcon, PlusIcon, RotateCcwIcon } from "lucide-react";

import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFormAction } from "@/components/use-form-action";
import type { ActionResult } from "@/lib/errors";
import type { TaxonomyKind } from "@/lib/schemas";
import type { LocationOption } from "@/lib/taxonomy";
import {
  createTaxonomyItemAction,
  updateTaxonomyItemAction,
} from "@/server/actions/taxonomy";

export interface ManagedItem {
  id: string;
  name: string;
  archived: boolean;
  /** Locations only - used to indent children under their parent. */
  depth?: number;
}

/**
 * Add, rename and archive the entries offered by the pickers.
 *
 * Entries are archived rather than deleted: an old episode tagged "Left
 * shoulder" must keep saying so even after you stop using that location.
 * Archived entries disappear from the pickers and can be brought back.
 */
export function TaxonomySection({
  kind,
  title,
  description,
  items,
  parentOptions,
  supportsMedicationFlag = false,
}: {
  kind: TaxonomyKind;
  title: string;
  description: string;
  items: readonly ManagedItem[];
  parentOptions?: readonly LocationOption[];
  supportsMedicationFlag?: boolean;
}) {
  const active = items.filter((item) => !item.archived);
  const archived = items.filter((item) => item.archived);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <ul className="flex flex-wrap gap-1.5">
          {active.map((item) => (
            <li key={item.id} className="flex items-center gap-0.5 rounded-full border pl-3">
              <span className="py-1.5 text-sm">
                {item.depth ? <span aria-hidden="true">↳ </span> : null}
                {item.name}
              </span>
              <RenameDialog kind={kind} item={item} />
              <ArchiveButton
                kind={kind}
                item={item}
                archived
                label={`Archive ${item.name}`}
              />
            </li>
          ))}
          {active.length === 0 && (
            <li className="text-muted-foreground text-sm">
              Nothing here yet - add the first entry below.
            </li>
          )}
        </ul>

        <AddItemForm
          kind={kind}
          parentOptions={parentOptions}
          supportsMedicationFlag={supportsMedicationFlag}
        />

        {archived.length > 0 && (
          <details className="rounded-lg border">
            <summary className="hover:bg-muted cursor-pointer rounded-lg px-3 py-2 text-sm font-medium select-none">
              Archived ({archived.length})
            </summary>
            <ul className="flex flex-wrap gap-1.5 border-t px-3 py-3">
              {archived.map((item) => (
                <li
                  key={item.id}
                  className="text-muted-foreground flex items-center gap-0.5 rounded-full border border-dashed pl-3"
                >
                  <span className="py-1.5 text-sm">{item.name}</span>
                  <ArchiveButton
                    kind={kind}
                    item={item}
                    archived={false}
                    label={`Restore ${item.name}`}
                  />
                </li>
              ))}
            </ul>
          </details>
        )}
      </CardContent>
    </Card>
  );
}

function AddItemForm({
  kind,
  parentOptions,
  supportsMedicationFlag,
}: {
  kind: TaxonomyKind;
  parentOptions?: readonly LocationOption[];
  supportsMedicationFlag: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const reset = useCallback(() => formRef.current?.reset(), []);

  const [result, formAction] = useFormAction(createTaxonomyItemAction, reset);

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      <input type="hidden" name="kind" value={kind} />

      <FormMessage result={result} successMessage="Added." />

      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-48 flex-1 space-y-2">
          <Label htmlFor={`${kind}-name`}>Add an entry</Label>
          <Input id={`${kind}-name`} name="name" required maxLength={200} />
        </div>

        {parentOptions && (
          <div className="min-w-48 flex-1 space-y-2">
            <Label htmlFor={`${kind}-parent`}>Inside (optional)</Label>
            <select
              id={`${kind}-parent`}
              name="parentId"
              defaultValue=""
              className="border-input bg-background focus-visible:ring-ring h-9 w-full rounded-lg border px-3 text-sm focus-visible:ring-3 focus-visible:outline-none"
            >
              <option value="">Top level</option>
              {parentOptions
                .filter((option) => !option.archived)
                .map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.path}
                  </option>
                ))}
            </select>
          </div>
        )}

        <SubmitButton pendingLabel="Adding...">
          <PlusIcon aria-hidden="true" />
          Add
        </SubmitButton>
      </div>

      {supportsMedicationFlag && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isMedication" />
          This is a medication (ask for name and dose when recording it)
        </label>
      )}
    </form>
  );
}

function ArchiveButton({
  kind,
  item,
  archived,
  label,
}: {
  kind: TaxonomyKind;
  item: ManagedItem;
  archived: boolean;
  label: string;
}) {
  const [, formAction] = useActionState<ActionResult<undefined> | null, FormData>(
    updateTaxonomyItemAction,
    null,
  );

  return (
    <form action={formAction}>
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="id" value={item.id} />
      <input type="hidden" name="archived" value={archived ? "true" : "false"} />
      <Button type="submit" variant="ghost" size="icon-sm" aria-label={label}>
        {archived ? (
          <ArchiveIcon aria-hidden="true" />
        ) : (
          <RotateCcwIcon aria-hidden="true" />
        )}
      </Button>
    </form>
  );
}

function RenameDialog({ kind, item }: { kind: TaxonomyKind; item: ManagedItem }) {
  const [open, setOpen] = useState(false);

  // Close once the rename lands. On failure it stays open so the message
  // remains readable next to the field that caused it.
  const close = useCallback(() => setOpen(false), []);

  const [result, formAction] = useFormAction(updateTaxonomyItemAction, close);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Rename ${item.name}`}>
          <PencilIcon aria-hidden="true" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename &ldquo;{item.name}&rdquo;</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="id" value={item.id} />

          <FormMessage result={result} />

          <div className="space-y-2">
            <Label htmlFor={`rename-${item.id}`}>New name</Label>
            <Input
              id={`rename-${item.id}`}
              name="name"
              defaultValue={item.name}
              required
              maxLength={200}
            />
            <p className="text-muted-foreground text-sm">
              Episodes already tagged with this entry will show the new name.
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton pendingLabel="Saving...">Save</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
