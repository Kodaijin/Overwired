"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ActivityIcon,
  CalendarDaysIcon,
  ChartColumnIcon,
  DatabaseIcon,
  LayoutDashboardIcon,
  ListIcon,
  MoonIcon,
  PlusIcon,
  SettingsIcon,
  SunIcon,
} from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logoutAction } from "@/server/actions/auth";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboardIcon },
  { href: "/episodes", label: "History", icon: ListIcon },
  { href: "/calendar", label: "Calendar", icon: CalendarDaysIcon },
  { href: "/statistics", label: "Statistics", icon: ChartColumnIcon },
  { href: "/data", label: "Data", icon: DatabaseIcon },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
] as const;

export function AppNav({ userLabel }: { userLabel: string }) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header className="bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky top-0 z-40 border-b backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2">
        <Link href="/" className="mr-1 flex items-center gap-2 font-semibold">
          <ActivityIcon className="size-5" aria-hidden="true" />
          <span className="hidden sm:inline">Pain Tracker</span>
        </Link>

        <nav aria-label="Main" className="min-w-0 flex-1">
          <ul className="flex items-center gap-0.5 overflow-x-auto">
            {NAV_ITEMS.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive(item.href) ? "page" : undefined}
                  className={cn(
                    "text-muted-foreground hover:bg-muted hover:text-foreground flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm whitespace-nowrap transition-colors",
                    isActive(item.href) && "bg-muted text-foreground font-medium",
                  )}
                >
                  <item.icon className="size-4" aria-hidden="true" />
                  <span className="hidden md:inline">{item.label}</span>
                  <span className="sr-only md:hidden">{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <Button asChild size="lg" className="shrink-0">
          <Link href="/episodes/new">
            <PlusIcon aria-hidden="true" />
            <span className="hidden sm:inline">Record pain</span>
            <span className="sm:hidden">Record</span>
          </Link>
        </Button>

        <UserMenu userLabel={userLabel} />
      </div>
    </header>
  );
}

function UserMenu({ userLabel }: { userLabel: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Account menu">
          <span aria-hidden="true" className="text-xs font-semibold">
            {initials(userLabel)}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="max-w-52 truncate">{userLabel}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <ThemeMenuItem />
        <DropdownMenuSeparator />
        <form action={logoutAction}>
          <button type="submit" className="w-full">
            <DropdownMenuItem asChild>
              <span>Sign out</span>
            </DropdownMenuItem>
          </button>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ThemeMenuItem() {
  const { resolvedTheme, setTheme } = useTheme();

  // The active theme is not known during server rendering. Rather than track a
  // "mounted" flag, the label stays constant and CSS picks the icon - so there
  // is nothing to mismatch on hydration.
  return (
    <DropdownMenuItem
      onSelect={(event) => {
        event.preventDefault();
        setTheme(resolvedTheme === "dark" ? "light" : "dark");
      }}
    >
      <SunIcon className="hidden size-4 dark:block" aria-hidden="true" />
      <MoonIcon className="size-4 dark:hidden" aria-hidden="true" />
      Switch theme
    </DropdownMenuItem>
  );
}

function initials(label: string): string {
  const parts = label.trim().split(/[\s@.]+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}
