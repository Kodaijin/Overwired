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
import { registerAction } from "@/server/actions/auth";

export function RegisterForm({ isFirstAccount }: { isFirstAccount: boolean }) {
  const [result, formAction] = useActionState<ActionResult<undefined> | null, FormData>(
    registerAction,
    null,
  );

  const fieldErrors = result && !result.ok ? result.fieldErrors : undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isFirstAccount ? "Create your account" : "Create an account"}</CardTitle>
        <CardDescription>
          {isFirstAccount
            ? "This is the first account on this server, so it will be the owner."
            : "Your pain log is private to your account."}
        </CardDescription>
      </CardHeader>

      <form action={formAction}>
        <CardContent className="space-y-4">
          <FormMessage result={result} />

          <div className="space-y-2">
            <Label htmlFor="name">
              Name <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input id="name" name="name" autoComplete="name" />
          </div>

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
              autoComplete="new-password"
              required
              minLength={10}
              aria-describedby="password-hint password-error"
              aria-invalid={fieldErrors?.password ? true : undefined}
            />
            <p id="password-hint" className="text-muted-foreground text-sm">
              At least 10 characters. A short phrase you will remember beats a
              short complicated word.
            </p>
            <FieldError id="password-error" messages={fieldErrors?.password} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm password</Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              aria-describedby={
                fieldErrors?.confirmPassword ? "confirm-error" : undefined
              }
              aria-invalid={fieldErrors?.confirmPassword ? true : undefined}
            />
            <FieldError id="confirm-error" messages={fieldErrors?.confirmPassword} />
          </div>
        </CardContent>

        <CardFooter className="mt-6 flex-col items-stretch gap-3">
          <SubmitButton size="lg" pendingLabel="Creating account...">
            Create account
          </SubmitButton>
          <p className="text-muted-foreground text-center text-sm">
            Already have an account?{" "}
            <Link href="/login" className="text-foreground underline">
              Sign in
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
