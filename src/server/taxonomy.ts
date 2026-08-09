import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { TaxonomyKind } from "@/lib/schemas";
import { buildLocationTree, type LocationOption, type TaxonomyOption } from "@/lib/taxonomy";
import { slugify } from "@/lib/taxonomy-defaults";

/**
 * Taxonomy data access.
 *
 * The five categories share a shape, so the generic helpers here dispatch on
 * `kind` rather than repeating the same query five times.
 */

export interface TreatmentTypeOption extends TaxonomyOption {
  isMedication: boolean;
}

export interface Taxonomy {
  locations: LocationOption[];
  characteristics: TaxonomyOption[];
  triggers: TaxonomyOption[];
  symptoms: TaxonomyOption[];
  treatmentTypes: TreatmentTypeOption[];
}

const listOrder = [{ sortOrder: "asc" as const }, { name: "asc" as const }];

/**
 * Loads everything the pickers need in one round trip.
 *
 * Archived entries are included so that an episode tagged with an
 * archived entry still renders its name; the pickers filter them out.
 */
export async function getTaxonomy(userId: string): Promise<Taxonomy> {
  const [locations, characteristics, triggers, symptoms, treatmentTypes] =
    await Promise.all([
      prisma.location.findMany({
        where: { userId },
        select: {
          id: true,
          name: true,
          parentId: true,
          archived: true,
          sortOrder: true,
        },
        orderBy: listOrder,
      }),
      prisma.characteristic.findMany({
        where: { userId },
        select: { id: true, name: true, archived: true },
        orderBy: listOrder,
      }),
      prisma.trigger.findMany({
        where: { userId },
        select: { id: true, name: true, archived: true },
        orderBy: listOrder,
      }),
      prisma.symptom.findMany({
        where: { userId },
        select: { id: true, name: true, archived: true },
        orderBy: listOrder,
      }),
      prisma.treatmentType.findMany({
        where: { userId },
        select: { id: true, name: true, archived: true, isMedication: true },
        orderBy: listOrder,
      }),
    ]);

  return {
    locations: buildLocationTree(locations),
    characteristics,
    triggers,
    symptoms,
    treatmentTypes,
  };
}

export class DuplicateTaxonomyError extends Error {
  constructor() {
    super("An entry with that name already exists");
    this.name = "DuplicateTaxonomyError";
  }
}

export async function createTaxonomyItem(
  userId: string,
  input: {
    kind: TaxonomyKind;
    name: string;
    parentId: string | null;
    isMedication: boolean;
  },
): Promise<string> {
  const slug = slugify(input.name);

  // A name that collides with an archived entry un-archives it instead of
  // failing: from the user's point of view they are adding it back.
  const existing = await findBySlug(prisma, userId, input.kind, slug);
  if (existing) {
    if (!existing.archived) throw new DuplicateTaxonomyError();
    await setArchived(userId, input.kind, existing.id, false);
    return existing.id;
  }

  switch (input.kind) {
    case "location": {
      const parent = input.parentId
        ? await prisma.location.findFirst({
            where: { id: input.parentId, userId },
            select: { id: true },
          })
        : null;
      const created = await prisma.location.create({
        data: { userId, name: input.name, slug, parentId: parent?.id ?? null, sortOrder: 1000 },
        select: { id: true },
      });
      return created.id;
    }
    case "characteristic": {
      const created = await prisma.characteristic.create({
        data: { userId, name: input.name, slug, sortOrder: 1000 },
        select: { id: true },
      });
      return created.id;
    }
    case "trigger": {
      const created = await prisma.trigger.create({
        data: { userId, name: input.name, slug, sortOrder: 1000 },
        select: { id: true },
      });
      return created.id;
    }
    case "symptom": {
      const created = await prisma.symptom.create({
        data: { userId, name: input.name, slug, sortOrder: 1000 },
        select: { id: true },
      });
      return created.id;
    }
    case "treatmentType": {
      const created = await prisma.treatmentType.create({
        data: {
          userId,
          name: input.name,
          slug,
          isMedication: input.isMedication,
          sortOrder: 1000,
        },
        select: { id: true },
      });
      return created.id;
    }
  }
}

export async function updateTaxonomyItem(
  userId: string,
  input: { kind: TaxonomyKind; id: string; name?: string; archived?: boolean },
): Promise<void> {
  if (input.archived != null) {
    await setArchived(userId, input.kind, input.id, input.archived);
  }

  if (input.name != null) {
    const slug = slugify(input.name);
    const clash = await findBySlug(prisma, userId, input.kind, slug);
    if (clash && clash.id !== input.id) throw new DuplicateTaxonomyError();
    await renameItem(userId, input.kind, input.id, input.name, slug);
  }
}

async function setArchived(
  userId: string,
  kind: TaxonomyKind,
  id: string,
  archived: boolean,
): Promise<void> {
  const where = { id, userId };
  const data = { archived };

  switch (kind) {
    case "location":
      await prisma.location.updateMany({ where, data });
      return;
    case "characteristic":
      await prisma.characteristic.updateMany({ where, data });
      return;
    case "trigger":
      await prisma.trigger.updateMany({ where, data });
      return;
    case "symptom":
      await prisma.symptom.updateMany({ where, data });
      return;
    case "treatmentType":
      await prisma.treatmentType.updateMany({ where, data });
      return;
  }
}

async function renameItem(
  userId: string,
  kind: TaxonomyKind,
  id: string,
  name: string,
  slug: string,
): Promise<void> {
  const where = { id, userId };
  const data = { name, slug };

  switch (kind) {
    case "location":
      await prisma.location.updateMany({ where, data });
      return;
    case "characteristic":
      await prisma.characteristic.updateMany({ where, data });
      return;
    case "trigger":
      await prisma.trigger.updateMany({ where, data });
      return;
    case "symptom":
      await prisma.symptom.updateMany({ where, data });
      return;
    case "treatmentType":
      await prisma.treatmentType.updateMany({ where, data });
      return;
  }
}

async function findBySlug(
  client: Prisma.TransactionClient | typeof prisma,
  userId: string,
  kind: TaxonomyKind,
  slug: string,
): Promise<{ id: string; archived: boolean } | null> {
  const where = { userId_slug: { userId, slug } };
  const select = { id: true, archived: true };

  switch (kind) {
    case "location":
      return client.location.findUnique({ where, select });
    case "characteristic":
      return client.characteristic.findUnique({ where, select });
    case "trigger":
      return client.trigger.findUnique({ where, select });
    case "symptom":
      return client.symptom.findUnique({ where, select });
    case "treatmentType":
      return client.treatmentType.findUnique({ where, select });
  }
}

/**
 * Resolves a name to a taxonomy id, creating the entry when it is new.
 *
 * Used by import: matching on slug means "Lower Back" and "lower back" land on
 * the same entry instead of producing near-duplicates.
 */
export async function resolveOrCreateByName(
  tx: Prisma.TransactionClient,
  userId: string,
  kind: TaxonomyKind,
  name: string,
): Promise<{ id: string; created: boolean }> {
  const slug = slugify(name);
  const existing = await findBySlug(tx, userId, kind, slug);
  if (existing) return { id: existing.id, created: false };

  // New entries sort after the seeded defaults.
  const data = { userId, name, slug, sortOrder: 1000 };

  switch (kind) {
    case "location": {
      const created = await tx.location.create({ data, select: { id: true } });
      return { id: created.id, created: true };
    }
    case "characteristic": {
      const created = await tx.characteristic.create({ data, select: { id: true } });
      return { id: created.id, created: true };
    }
    case "trigger": {
      const created = await tx.trigger.create({ data, select: { id: true } });
      return { id: created.id, created: true };
    }
    case "symptom": {
      const created = await tx.symptom.create({ data, select: { id: true } });
      return { id: created.id, created: true };
    }
    case "treatmentType": {
      const created = await tx.treatmentType.create({ data, select: { id: true } });
      return { id: created.id, created: true };
    }
  }
}
