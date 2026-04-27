import { auth } from "@clerk/nextjs/server";

// Org admin = the role Clerk assigns to whoever created the org, plus anyone
// promoted via the OrganizationProfile UI. Members default to org:member.
//
// Personal mode (no active org) has no role concept — `has({ role })` returns
// false. Treat personal-mode users as non-admins for write-gated features;
// since the family flow is org-mode, this is intended.
export async function isOrgAdmin(): Promise<boolean> {
  const { has } = await auth();
  return has({ role: "org:admin" });
}
