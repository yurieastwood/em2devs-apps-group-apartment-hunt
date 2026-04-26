import Link from "next/link";
import { UserButton } from "@clerk/nextjs";

export function AppHeader() {
  return (
    <header className="border-b border-border bg-background">
      <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
        <Link href="/" className="font-semibold">
          Apartment Hunt
        </Link>
        <nav className="flex items-center gap-4">
          <Link
            href="/listings/import"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Import
          </Link>
          <Link
            href="/listings/new"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Add listing
          </Link>
          <UserButton />
        </nav>
      </div>
    </header>
  );
}
