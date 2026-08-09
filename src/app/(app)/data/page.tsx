import type { Metadata } from "next";
import Link from "next/link";
import { DownloadIcon } from "lucide-react";

import { ImportForm } from "@/components/import-form";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireUser } from "@/lib/auth/user";

export const metadata: Metadata = { title: "Data" };

const EXPORTS = [
  {
    href: "/api/export?format=json",
    title: "Full backup (JSON)",
    description:
      "Everything needed to rebuild your history, and the only format this app can import.",
  },
  {
    href: "/api/export?format=csv&dataset=episodes",
    title: "Episodes (CSV)",
    description:
      "One row per episode with its duration, severities and tags. Opens in any spreadsheet.",
  },
  {
    href: "/api/export?format=csv&dataset=measurements",
    title: "Pain readings (CSV)",
    description: "One row per reading - the right shape for charting elsewhere.",
  },
  {
    href: "/api/export?format=csv&dataset=treatments",
    title: "Treatments (CSV)",
    description: "One row per recorded treatment, with doses and relief scores.",
  },
] as const;

export default async function DataPage() {
  await requireUser();

  return (
    <>
      <PageHeader
        title="Data"
        description="Your records are yours. Take them out whenever you like, and bring them back in."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Export</CardTitle>
            <CardDescription>
              Downloads start immediately and are never sent anywhere else.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {EXPORTS.map((option) => (
              <div
                key={option.href}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
              >
                <div className="min-w-0">
                  <p className="font-medium">{option.title}</p>
                  <p className="text-muted-foreground text-sm text-balance">
                    {option.description}
                  </p>
                </div>
                <Button asChild variant="outline">
                  <Link href={option.href} prefetch={false}>
                    <DownloadIcon aria-hidden="true" />
                    Download
                  </Link>
                </Button>
              </div>
            ))}

            <p className="text-muted-foreground text-sm">
              To export a subset, apply filters on the History page and use
              &ldquo;Export these&rdquo; there.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Import</CardTitle>
            <CardDescription>
              Bring in a JSON export from this app.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ImportForm />
          </CardContent>
        </Card>
      </div>

      <Alert className="mt-6">
        <AlertTitle>Where your data lives</AlertTitle>
        <AlertDescription>
          Everything you record stays in the PostgreSQL database on this server.
          Nothing is sent to any third party, and there is no analytics or
          tracking. Regular exports are still worth keeping - see the backup
          instructions in the README.
        </AlertDescription>
      </Alert>
    </>
  );
}
