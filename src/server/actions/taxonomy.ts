"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/user";
import {
  actionError,
  actionOk,
  validationError,
  withActionErrorHandling,
  type ActionResult,
} from "@/lib/errors";
import { boolean, text } from "@/lib/form-data";
import { createTaxonomyItemSchema, updateTaxonomyItemSchema } from "@/lib/schemas";
import { createTaxonomyItem, DuplicateTaxonomyError, updateTaxonomyItem } from "@/server/taxonomy";

function refreshTaxonomyViews(): void {
  revalidatePath("/settings");
  revalidatePath("/episodes");
  revalidatePath("/episodes/new");
}

export async function createTaxonomyItemAction(
  _previous: ActionResult<undefined> | null,
  formData: FormData,
): Promise<ActionResult<undefined>> {
  const user = await requireUser();

  return withActionErrorHandling("createTaxonomyItemAction", async () => {
    const parsed = createTaxonomyItemSchema.safeParse({
      kind: text(formData, "kind"),
      name: text(formData, "name"),
      parentId: text(formData, "parentId"),
      isMedication: boolean(formData, "isMedication"),
    });

    if (!parsed.success) return validationError(parsed.error);

    try {
      await createTaxonomyItem(user.id, parsed.data);
    } catch (error) {
      if (error instanceof DuplicateTaxonomyError) {
        return actionError("You already have an entry with that name.", {
          name: ["You already have an entry with that name"],
        });
      }
      throw error;
    }

    refreshTaxonomyViews();
    return actionOk();
  });
}

export async function updateTaxonomyItemAction(
  _previous: ActionResult<undefined> | null,
  formData: FormData,
): Promise<ActionResult<undefined>> {
  const user = await requireUser();

  return withActionErrorHandling("updateTaxonomyItemAction", async () => {
    const archivedField = formData.get("archived");

    const parsed = updateTaxonomyItemSchema.safeParse({
      kind: text(formData, "kind"),
      id: text(formData, "id"),
      name: text(formData, "name"),
      // Absent means "leave the archived state alone".
      archived: archivedField == null ? undefined : boolean(formData, "archived"),
    });

    if (!parsed.success) return validationError(parsed.error);

    try {
      await updateTaxonomyItem(user.id, parsed.data);
    } catch (error) {
      if (error instanceof DuplicateTaxonomyError) {
        return actionError("You already have an entry with that name.", {
          name: ["You already have an entry with that name"],
        });
      }
      throw error;
    }

    refreshTaxonomyViews();
    return actionOk();
  });
}
