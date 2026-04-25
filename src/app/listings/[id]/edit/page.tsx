import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { db } from "@/db/client";
import { listings } from "@/db/schema";
import { EditListingForm } from "./edit-form";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export default async function EditListingPage({ params }: { params: Params }) {
  const { id } = await params;
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const [listing] = await db
    .select()
    .from(listings)
    .where(eq(listings.id, id))
    .limit(1);

  if (!listing) notFound();
  if (listing.ownerClerkUserId !== userId) notFound();

  return (
    <main className="flex-1 max-w-2xl mx-auto p-8 w-full">
      <h1 className="text-2xl font-semibold mb-6">Edit listing</h1>
      <EditListingForm listing={listing} />
    </main>
  );
}
