import { ActivityIcon } from "lucide-react";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 p-4">
      <div className="flex items-center gap-2 text-lg font-semibold">
        <ActivityIcon className="size-5" aria-hidden="true" />
        <span>Overwired</span>
      </div>
      <div className="w-full max-w-sm">{children}</div>
      <p className="text-muted-foreground max-w-sm text-center text-xs text-balance">
        A private record of your symptoms. It is a tracking tool, not medical
        advice or a diagnosis.
      </p>
    </main>
  );
}
