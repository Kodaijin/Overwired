/**
 * Default taxonomy seeded into a new account.
 *
 * These are starting points, not a fixed vocabulary: every entry can be
 * renamed, archived or added to from the Settings page, and episodes can
 * reference user-created entries exactly the same way.
 */

export interface DefaultLocation {
  name: string;
  /** Nested locations, e.g. Shoulders > Left shoulder. */
  children?: string[];
}

export const DEFAULT_LOCATIONS: readonly DefaultLocation[] = [
  { name: "Head" },
  { name: "Face" },
  { name: "Neck" },
  { name: "Shoulders", children: ["Left shoulder", "Right shoulder"] },
  { name: "Chest" },
  { name: "Upper back" },
  { name: "Lower back" },
  { name: "Abdomen" },
  { name: "Pelvis" },
  { name: "Arms", children: ["Left arm", "Right arm"] },
  { name: "Hands", children: ["Left hand", "Right hand"] },
  { name: "Legs", children: ["Left leg", "Right leg"] },
  { name: "Feet", children: ["Left foot", "Right foot"] },
  { name: "Generalized / Whole body" },
  { name: "Other" },
];

export const DEFAULT_CHARACTERISTICS: readonly string[] = [
  "Sharp",
  "Dull",
  "Aching",
  "Burning",
  "Stabbing",
  "Throbbing",
  "Pulsing",
  "Cramping",
  "Pressure",
  "Tightness",
  "Tingling",
  "Electric",
  "Shooting",
  "Pins and needles",
  "Numb",
  "Itching",
  "Tender",
  "Sore",
  "Other",
];

export const DEFAULT_TRIGGERS: readonly string[] = [
  "Movement",
  "Exercise",
  "Walking",
  "Sitting",
  "Standing",
  "Lying down",
  "Eating",
  "Drinking",
  "Stress",
  "Anxiety",
  "Lack of sleep",
  "Weather",
  "Temperature",
  "Touch",
  "Pressure",
  "Breathing",
  "Coughing",
  "Laughing",
  "Unknown",
  "Other",
];

export const DEFAULT_SYMPTOMS: readonly string[] = [
  "Nausea",
  "Dizziness",
  "Headache",
  "Fatigue",
  "Weakness",
  "Tingling",
  "Numbness",
  "Sweating",
  "Chills",
  "Fever",
  "Shortness of breath",
  "Muscle weakness",
  "Muscle spasms",
  "Skin sensitivity",
  "Goosebumps",
  "Vision changes",
  "Light sensitivity",
  "Sound sensitivity",
  "Other",
];

export interface DefaultTreatmentType {
  name: string;
  /** Shows the medication name/dose fields when selected. */
  isMedication?: boolean;
}

export const DEFAULT_TREATMENT_TYPES: readonly DefaultTreatmentType[] = [
  { name: "Medication", isMedication: true },
  { name: "Rest" },
  { name: "Ice" },
  { name: "Heat" },
  { name: "Stretching" },
  { name: "Massage" },
  { name: "Exercise" },
  { name: "Hydration" },
  { name: "Sleep" },
  { name: "Physical therapy" },
  { name: "Position change" },
  { name: "Other" },
];

/**
 * URL/identity-safe key for a taxonomy entry, unique per user.
 *
 * Slugs make imports idempotent: importing the same file twice matches
 * existing entries by slug instead of creating near-duplicates.
 */
export function slugify(name: string): string {
  const slug = name
    .normalize("NFKD")
    // Strip combining marks so "Café" and "Cafe" collapse to one slug.
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  // Names made entirely of non-latin characters would otherwise slug to "".
  return slug || fallbackSlug(name);
}

function fallbackSlug(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return `item-${Math.abs(hash).toString(36)}`;
}
