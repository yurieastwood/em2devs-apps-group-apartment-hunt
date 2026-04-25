import Link from "next/link";
import { UserButton } from "@clerk/nextjs";

export function AppHeader() {
  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
        <Link href="/" className="font-semibold text-gray-900">
          Apartment Hunt
        </Link>
        <nav className="flex items-center gap-4">
          <Link
            href="/listings/new"
            className="text-sm text-gray-700 hover:text-gray-900"
          >
            Add listing
          </Link>
          <UserButton />
        </nav>
      </div>
    </header>
  );
}
