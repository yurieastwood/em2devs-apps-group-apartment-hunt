import { eq } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/client";
import { reactions } from "@/db/schema";
import {
  ReactionsBarClient,
  type ReactionCounts,
} from "./reactions-bar-client";

const EMOJIS = ["❤️", "👍", "🔥", "😍", "🤔", "👎"];

export async function ReactionsBar({ listingId }: { listingId: string }) {
  const { userId } = await auth();

  const rows = await db
    .select({
      emoji: reactions.emoji,
      authorClerkUserId: reactions.authorClerkUserId,
    })
    .from(reactions)
    .where(eq(reactions.listingId, listingId));

  const counts: ReactionCounts = {};
  for (const r of rows) {
    const entry = counts[r.emoji] ?? { count: 0, userReacted: false };
    entry.count += 1;
    if (r.authorClerkUserId === userId) entry.userReacted = true;
    counts[r.emoji] = entry;
  }

  return (
    <ReactionsBarClient
      listingId={listingId}
      emojis={EMOJIS}
      counts={counts}
      isAuthenticated={!!userId}
    />
  );
}
