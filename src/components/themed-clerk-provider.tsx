"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { useSyncExternalStore } from "react";

const MEDIA_QUERY = "(prefers-color-scheme: dark)";

function subscribe(callback: () => void) {
  const mq = window.matchMedia(MEDIA_QUERY);
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}

function getSnapshot() {
  return window.matchMedia(MEDIA_QUERY).matches;
}

function getServerSnapshot() {
  return false;
}

// Wraps ClerkProvider with a `dark` baseTheme when the system reports
// prefers-color-scheme: dark. The page background already auto-flips via CSS
// variables, but Clerk's own components (OrganizationSwitcher dropdown,
// UserButton menu, sign-in flow) need an explicit baseTheme — variables alone
// don't reach all of Clerk's internal tokens.
//
// Subscribing via useSyncExternalStore avoids the setState-in-effect lint
// rule and keeps the value in sync if the user flips system theme live.
export function ThemedClerkProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const isDark = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return (
    <ClerkProvider
      appearance={{
        baseTheme: isDark ? dark : undefined,
        variables: {
          colorPrimary: "var(--primary)",
          colorDanger: "var(--destructive)",
        },
        elements: {
          // Trigger buttons sit in our header, not a Clerk-styled container,
          // so Clerk's baseTheme doesn't reach the trigger text. Force the
          // page's --foreground / --muted-foreground vars (which auto-flip
          // with prefers-color-scheme).
          organizationSwitcherTrigger: {
            color: "var(--foreground)",
          },
          organizationPreviewMainIdentifier: {
            color: "var(--foreground)",
          },
          organizationPreviewSecondaryIdentifier: {
            color: "var(--muted-foreground)",
          },
          userButtonBox: {
            color: "var(--foreground)",
          },
          userPreviewMainIdentifier: {
            color: "var(--foreground)",
          },
          userPreviewSecondaryIdentifier: {
            color: "var(--muted-foreground)",
          },
        },
      }}
    >
      {children}
    </ClerkProvider>
  );
}
