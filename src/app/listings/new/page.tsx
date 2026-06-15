import Link from "next/link";
import { redirect } from "next/navigation";
import { isOrgAdmin } from "@/lib/auth/roles";
import { NewListingForm } from "./new-listing-form";
import { ImportForm } from "./import-form";
import { ManualForm } from "./manual-form";

export const runtime = "nodejs";
export const maxDuration = 60;

type SearchParams = Promise<{ mode?: string }>;

export default async function NewListingPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  if (!(await isOrgAdmin())) redirect("/");

  const { mode } = await searchParams;
  const isBulk = mode === "bulk";
  const isManual = mode === "manual";
  const isUrl = !isBulk && !isManual;

  return (
    <main className="flex-1 max-w-3xl mx-auto p-8 w-full">
      <h1 className="text-2xl font-semibold mb-2">Add a listing</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Paste one URL, bulk-import many at once, or enter a listing by hand —
        handy for places you found while walking a neighborhood.
      </p>

      <div className="flex border-b border-border mb-6">
        <TabLink href="/listings/new" active={isUrl}>
          Single URL
        </TabLink>
        <TabLink href="/listings/new?mode=bulk" active={isBulk}>
          Bulk import
        </TabLink>
        <TabLink href="/listings/new?mode=manual" active={isManual}>
          Manual entry
        </TabLink>
      </div>

      {isBulk ? <ImportForm /> : isManual ? <ManualForm /> : <NewListingForm />}
    </main>
  );
}

function TabLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`px-4 py-2 text-sm border-b-2 -mb-px transition-colors ${
        active
          ? "border-primary text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </Link>
  );
}
