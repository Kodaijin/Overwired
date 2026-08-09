import type { Prisma } from "@/generated/prisma/client";
import {
  DEFAULT_CHARACTERISTICS,
  DEFAULT_LOCATIONS,
  DEFAULT_SYMPTOMS,
  DEFAULT_TREATMENT_TYPES,
  DEFAULT_TRIGGERS,
  slugify,
} from "@/lib/taxonomy-defaults";

/**
 * Seeds a new account with the default taxonomy.
 *
 * Runs inside the registration transaction so an account is never left without
 * anything to pick from. Locations are inserted parents-first so children can
 * reference them.
 */
export async function seedDefaultTaxonomy(
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<void> {
  let locationOrder = 0;

  for (const definition of DEFAULT_LOCATIONS) {
    const parent = await tx.location.create({
      data: {
        userId,
        name: definition.name,
        slug: slugify(definition.name),
        isDefault: true,
        sortOrder: locationOrder,
      },
    });
    locationOrder += 1;

    if (definition.children?.length) {
      await tx.location.createMany({
        data: definition.children.map((child, index) => ({
          userId,
          name: child,
          slug: slugify(child),
          parentId: parent.id,
          isDefault: true,
          sortOrder: locationOrder + index,
        })),
      });
      locationOrder += definition.children.length;
    }
  }

  await tx.characteristic.createMany({
    data: DEFAULT_CHARACTERISTICS.map((name, index) => ({
      userId,
      name,
      slug: slugify(name),
      isDefault: true,
      sortOrder: index,
    })),
  });

  await tx.trigger.createMany({
    data: DEFAULT_TRIGGERS.map((name, index) => ({
      userId,
      name,
      slug: slugify(name),
      isDefault: true,
      sortOrder: index,
    })),
  });

  await tx.symptom.createMany({
    data: DEFAULT_SYMPTOMS.map((name, index) => ({
      userId,
      name,
      slug: slugify(name),
      isDefault: true,
      sortOrder: index,
    })),
  });

  await tx.treatmentType.createMany({
    data: DEFAULT_TREATMENT_TYPES.map((type, index) => ({
      userId,
      name: type.name,
      slug: slugify(type.name),
      isMedication: type.isMedication ?? false,
      isDefault: true,
      sortOrder: index,
    })),
  });
}

export interface TaxonomyOption {
  id: string;
  name: string;
  archived: boolean;
}

export interface LocationOption extends TaxonomyOption {
  parentId: string | null;
  /** "Shoulders / Left shoulder" - used for labels in lists and exports. */
  path: string;
  depth: number;
}

/**
 * Flattens the location tree into a depth-first list so a plain `<select>` or
 * checkbox column can render the hierarchy without a nested component.
 */
export function buildLocationTree(
  locations: readonly {
    id: string;
    name: string;
    parentId: string | null;
    archived: boolean;
    sortOrder: number;
  }[],
): LocationOption[] {
  const byParent = new Map<string | null, typeof locations[number][]>();

  for (const location of locations) {
    const siblings = byParent.get(location.parentId) ?? [];
    siblings.push(location);
    byParent.set(location.parentId, siblings);
  }

  for (const siblings of byParent.values()) {
    siblings.sort(
      (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
    );
  }

  const result: LocationOption[] = [];
  const seen = new Set<string>();

  const walk = (parentId: string | null, prefix: string, depth: number): void => {
    for (const location of byParent.get(parentId) ?? []) {
      // Guards against a cycle introduced by hand-edited data.
      if (seen.has(location.id)) continue;
      seen.add(location.id);

      const path = prefix ? `${prefix} / ${location.name}` : location.name;
      result.push({
        id: location.id,
        name: location.name,
        parentId: location.parentId,
        archived: location.archived,
        path,
        depth,
      });
      walk(location.id, path, depth + 1);
    }
  };

  walk(null, "", 0);

  // Any row whose parent was deleted mid-flight still needs to be reachable.
  for (const location of locations) {
    if (!seen.has(location.id)) {
      result.push({
        id: location.id,
        name: location.name,
        parentId: location.parentId,
        archived: location.archived,
        path: location.name,
        depth: 0,
      });
    }
  }

  return result;
}
