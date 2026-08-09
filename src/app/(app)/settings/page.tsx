import type { Metadata } from "next";

import { PageHeader } from "@/components/page-header";
import { TaxonomySection } from "@/components/taxonomy-manager";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireUser } from "@/lib/auth/user";
import { getTaxonomy } from "@/server/taxonomy";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser();
  const taxonomy = await getTaxonomy(user.id);

  return (
    <>
      <PageHeader
        title="Settings"
        description="Tailor the lists you choose from when recording pain."
      />

      <div className="space-y-6">
        <TaxonomySection
          kind="location"
          title="Locations"
          description="Where pain happens. Entries can sit inside another, for example a specific side under a general area."
          items={taxonomy.locations.map((location) => ({
            id: location.id,
            name: location.name,
            archived: location.archived,
            depth: location.depth,
          }))}
          parentOptions={taxonomy.locations}
        />

        <TaxonomySection
          kind="characteristic"
          title="Characteristics"
          description="How the pain feels - sharp, burning, throbbing, and anything else you want to describe."
          items={taxonomy.characteristics}
        />

        <TaxonomySection
          kind="trigger"
          title="Triggers"
          description="Things you want to note as possibly setting pain off."
          items={taxonomy.triggers}
        />

        <TaxonomySection
          kind="symptom"
          title="Symptoms"
          description="Anything that shows up alongside the pain."
          items={taxonomy.symptoms}
        />

        <TaxonomySection
          kind="treatmentType"
          title="Treatments"
          description="What you try. Mark an entry as a medication to be asked for its name and dose."
          items={taxonomy.treatmentTypes}
          supportsMedicationFlag
        />

        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>Signed in as {user.email}</CardDescription>
          </CardHeader>
          <CardContent className="text-muted-foreground space-y-2 text-sm">
            <p>
              Password changes and additional accounts are handled from the
              server with the <code>create-user</code> script - see the README.
            </p>
            <p>
              Signing out everywhere is done by rotating <code>AUTH_SECRET</code>{" "}
              and restarting the app.
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
