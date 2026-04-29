import Link from "next/link";
import { OrganizationSwitcher, UserButton } from "@clerk/nextjs";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { isOrgAdmin } from "@/lib/auth/roles";
import { GoogleTranslate } from "./google-translate";

async function getActiveOrgName(orgId: string | null | undefined): Promise<string | null> {
  if (!orgId) return null;
  try {
    const client = await clerkClient();
    const org = await client.organizations.getOrganization({
      organizationId: orgId,
    });
    return org.name ?? null;
  } catch {
    return null;
  }
}

export async function AppHeader() {
  const { orgId } = await auth();
  const isAdmin = await isOrgAdmin();
  const orgName = isAdmin ? null : await getActiveOrgName(orgId);

  return (
    <header className="border-b border-border bg-background">
      <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
        <Link href="/" className="font-semibold">
          Apartment Hunt
        </Link>
        <nav className="flex items-center gap-4">
          {isAdmin ? (
            <Link
              href="/listings/new"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Add listing
            </Link>
          ) : null}
          {isAdmin ? (
            <OrganizationSwitcher
              hidePersonal={false}
              afterCreateOrganizationUrl="/"
              afterSelectOrganizationUrl="/"
              afterSelectPersonalUrl="/"
            />
          ) : orgName ? (
            <span className="text-sm text-muted-foreground">{orgName}</span>
          ) : null}
          <GoogleTranslate />
          <UserButton />
        </nav>
      </div>
    </header>
  );
}
