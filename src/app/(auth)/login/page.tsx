import type { Metadata } from "next";

import { LoginForm } from "@/components/login-form";
import { isRegistrationOpen } from "@/lib/auth/user";

export const metadata: Metadata = { title: "Sign in" };

// Whether registration is open depends on the database, so this page must be
// rendered per request - never prerendered at build time, when there is no
// database to ask.
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  return <LoginForm registrationOpen={await isRegistrationOpen()} />;
}
