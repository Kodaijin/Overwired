"use client";

import Link from "next/link";
import { useEffect } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

/**
 * Page-level error boundary.
 *
 * Shows what the user can do about it and nothing else. The underlying error
 * stays in the server logs - a stack trace or database message here could
 * expose both internals and, in this app, health information.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Only the digest, which is the key for finding the real entry in the logs.
    console.error(`[client error boundary] digest=${error.digest ?? "none"}`);
  }, [error]);

  return (
    <div className="mx-auto max-w-lg py-12">
      <Alert variant="destructive">
        <AlertTitle>Something went wrong on this page</AlertTitle>
        <AlertDescription>
          Your recorded data has not been changed. Try again, and if it keeps
          happening the server log will have the details.
          {error.digest && (
            <p className="font-mono text-xs">Reference: {error.digest}</p>
          )}
        </AlertDescription>
      </Alert>

      <div className="mt-4 flex gap-2">
        <Button onClick={reset}>Try again</Button>
        <Button asChild variant="outline">
          <Link href="/">Back to dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
