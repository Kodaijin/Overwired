import type { Metadata } from "next";
import Link from "next/link";

import { RegisterForm } from "@/components/register-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { isRegistrationOpen, userCount } from "@/lib/auth/user";

export const metadata: Metadata = { title: "Create account" };

// Depends on the database (is this the first account? is registration open?),
// so it must not be prerendered at build time.
export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const [open, existingUsers] = await Promise.all([isRegistrationOpen(), userCount()]);

  if (!open) {
    return (
      <div className="space-y-4">
        <Alert>
          <AlertTitle>Registration is closed</AlertTitle>
          <AlertDescription>
            This server is not accepting new accounts. Ask the administrator to
            create one for you with the <code>create-user</code> script.
          </AlertDescription>
        </Alert>
        <Button asChild className="w-full" size="lg">
          <Link href="/login">Back to sign in</Link>
        </Button>
      </div>
    );
  }

  return <RegisterForm isFirstAccount={existingUsers === 0} />;
}
