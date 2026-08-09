"use server";

import { redirect } from "next/navigation";

import {
  actionError,
  validationError,
  withActionErrorHandling,
  type ActionResult,
} from "@/lib/errors";
import { text } from "@/lib/form-data";
import { loginSchema, registerSchema } from "@/lib/schemas";
import { createSession, destroySession } from "@/lib/auth/session";
import { authenticate, isRegistrationOpen, registerUser } from "@/lib/auth/user";

export async function loginAction(
  _previous: ActionResult<undefined> | null,
  formData: FormData,
): Promise<ActionResult<undefined>> {
  const result = await withActionErrorHandling("loginAction", async () => {
    const parsed = loginSchema.safeParse({
      email: text(formData, "email"),
      password: text(formData, "password"),
    });

    if (!parsed.success) return validationError(parsed.error);

    const user = await authenticate(parsed.data.email, parsed.data.password);

    // Deliberately identical for "no such account" and "wrong password".
    if (!user) return actionError("That email address and password do not match.");

    await createSession(user.id);
    return { ok: true as const, data: undefined };
  });

  // `redirect` throws, so it must happen outside the error-handling wrapper's
  // try block to avoid being reported as a failure.
  if (result.ok) redirect("/");
  return result;
}

export async function registerAction(
  _previous: ActionResult<undefined> | null,
  formData: FormData,
): Promise<ActionResult<undefined>> {
  const result = await withActionErrorHandling("registerAction", async () => {
    if (!(await isRegistrationOpen())) {
      return actionError(
        "Registration is closed on this server. Ask the administrator to create an account for you.",
      );
    }

    const parsed = registerSchema.safeParse({
      email: text(formData, "email"),
      name: text(formData, "name"),
      password: text(formData, "password"),
    });

    if (!parsed.success) return validationError(parsed.error);

    const confirmation = text(formData, "confirmPassword");
    if (confirmation !== parsed.data.password) {
      return actionError("The two passwords do not match.", {
        confirmPassword: ["The two passwords do not match"],
      });
    }

    const created = await registerUser({
      email: parsed.data.email,
      name: parsed.data.name,
      password: parsed.data.password,
    });

    if (!created.ok) {
      return created.error === "email-taken"
        ? actionError("An account with that email address already exists.", {
            email: ["An account with that email address already exists"],
          })
        : actionError("Registration is closed on this server.");
    }

    await createSession(created.userId);
    return { ok: true as const, data: undefined };
  });

  if (result.ok) redirect("/");
  return result;
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}
