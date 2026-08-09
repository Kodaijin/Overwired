"use client";

import { useActionState, useState } from "react";
import { Trash2Icon } from "lucide-react";

import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { ActionResult } from "@/lib/errors";

/**
 * Destructive action behind a confirmation dialog.
 *
 * Deleting an episode also removes its readings and treatments, so the dialog
 * says exactly what is about to disappear rather than asking "are you sure?".
 */
export function ConfirmDeleteForm({
  action,
  hiddenFields,
  triggerLabel,
  title,
  description,
  confirmLabel = "Delete",
  triggerVariant = "destructive",
  triggerSize = "default",
}: {
  action: (
    previous: ActionResult<undefined> | null,
    formData: FormData,
  ) => Promise<ActionResult<undefined>>;
  hiddenFields: Record<string, string>;
  triggerLabel: string;
  title: string;
  description: string;
  confirmLabel?: string;
  triggerVariant?: React.ComponentProps<typeof Button>["variant"];
  triggerSize?: React.ComponentProps<typeof Button>["size"];
}) {
  const [open, setOpen] = useState(false);
  const [result, formAction] = useActionState<ActionResult<undefined> | null, FormData>(
    action,
    null,
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={triggerVariant} size={triggerSize}>
          <Trash2Icon aria-hidden="true" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          {Object.entries(hiddenFields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}

          <FormMessage result={result} />

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton variant="destructive" pendingLabel="Deleting...">
              {confirmLabel}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
