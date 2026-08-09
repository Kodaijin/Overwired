"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * Light/dark theming.
 *
 * Defaults to the system setting - a pain log gets opened at 3am as often as
 * at midday.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
