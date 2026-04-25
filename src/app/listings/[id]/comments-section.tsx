import { asc, eq } from "drizzle-orm";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { db } from "@/db/client";
import { comments } from "@/db/schema";
import { CommentForm } from "./comment-form";
import { DeleteCommentButton } from "./delete-comment-button";

type Author = {
  displayName: string;
  imageUrl: string | null;
};

async function loadAuthors(userIds: string[]): Promise<Map<string, Author>> {
  if (userIds.length === 0) return new Map();
  try {
    const client = await clerkClient();
    const list = await client.users.getUserList({ userId: userIds });
    return new Map(
      list.data.map((u) => [
        u.id,
        {
          displayName:
            [u.firstName, u.lastName].filter(Boolean).join(" ") ||
            u.username ||
            u.primaryEmailAddress?.emailAddress ||
            "Unknown",
          imageUrl: u.imageUrl ?? null,
        },
      ]),
    );
  } catch (err) {
    console.error("clerk users fetch failed:", err);
    return new Map();
  }
}

function fmtDate(d: Date): string {
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export async function CommentsSection({ listingId }: { listingId: string }) {
  const { userId } = await auth();

  const rows = await db
    .select()
    .from(comments)
    .where(eq(comments.listingId, listingId))
    .orderBy(asc(comments.createdAt));

  const authorIds = [...new Set(rows.map((r) => r.authorClerkUserId))];
  const authors = await loadAuthors(authorIds);

  return (
    <section className="mt-8 border-t border-border pt-6">
      <h2 className="text-lg font-semibold mb-4">
        Comments{rows.length > 0 ? ` (${rows.length})` : ""}
      </h2>

      {userId ? <CommentForm listingId={listingId} /> : null}

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground mt-4">No comments yet.</p>
      ) : (
        <ul className="mt-6 space-y-5">
          {rows.map((comment) => {
            const author = authors.get(comment.authorClerkUserId);
            const isOwn = comment.authorClerkUserId === userId;
            return (
              <li key={comment.id} className="flex gap-3">
                {author?.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={author.imageUrl}
                    alt={author.displayName}
                    className="w-8 h-8 rounded-full shrink-0"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-muted shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm flex items-baseline gap-2 flex-wrap">
                    <span className="font-medium">
                      {author?.displayName ?? "Unknown"}
                    </span>
                    <time className="text-muted-foreground text-xs">
                      {fmtDate(comment.createdAt)}
                    </time>
                    {isOwn ? (
                      <DeleteCommentButton
                        commentId={comment.id}
                        listingId={listingId}
                      />
                    ) : null}
                  </p>
                  <p className="text-sm whitespace-pre-line mt-1">
                    {comment.body}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
