"use client";

import Link from "next/link";
import { useActionState } from "react";

import { FieldError, FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionResult } from "@/lib/errors";
import { loginAction } from "@/server/actions/auth";

export function LoginForm({
  registrationOpen,
}: {
  registrationOpen: boolean;
}) {
  const [result, formAction] = useActionState<ActionResult<undefined> | null, FormData>(
    loginAction,
    null,
  );

  const fieldErrors = result && !result.ok ? result.fieldErrors : undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>Enter your details to reach your pain log.</CardDescription>
      </CardHeader>

      <form action={formAction}>
        <CardContent className="space-y-4">
          <FormMessage result={result} />

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              required
              aria-describedby={fieldErrors?.email ? "email-error" : undefined}
              aria-invalid={fieldErrors?.email ? true : undefined}
            />
            <FieldError id="email-error" messages={fieldErrors?.email} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              aria-describedby={fieldErrors?.password ? "password-error" : undefined}
              aria-invalid={fieldErrors?.password ? true : undefined}
            />
            <FieldError id="password-error" messages={fieldErrors?.password} />
          </div>
        </CardContent>

        <CardFooter className="mt-6 flex-col items-stretch gap-3">
          <SubmitButton size="lg" pendingLabel="Signing in...">
            Sign in
          </SubmitButton>

          {registrationOpen && (
            <p className="text-muted-foreground text-center text-sm">
              No account yet?{" "}
              <Link href="/register" className="text-foreground underline">
                Create one
              </Link>
            </p>
          )}
        </CardFooter>
      </form>
    </Card>
  );
}
