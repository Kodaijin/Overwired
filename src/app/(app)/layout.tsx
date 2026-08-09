import { AppNav } from "@/components/app-nav";
import { requireUser } from "@/lib/auth/user";

/**
 * Shell for every signed-in page.
 *
 * `requireUser` is the authority on authentication: it verifies the session
 * signature and confirms the account still exists. The proxy's cookie check is
 * only a fast path in front of this.
 */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();

  return (
    <div className="flex min-h-svh flex-col">
      <AppNav userLabel={user.name || user.email} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
