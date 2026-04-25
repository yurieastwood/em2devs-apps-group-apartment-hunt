"use client";

import { useTransition } from "react";
import { toggleReactionAction } from "./actions";

export type ReactionCounts = Record<
  string,
  { count: number; userReacted: boolean }
>;

type Props = {
  listingId: string;
  emojis: string[];
  counts: ReactionCounts;
  isAuthenticated: boolean;
};

export function ReactionsBarClient({
  listingId,
  emojis,
  counts,
  isAuthenticated,
}: Props) {
  const [pending, startTransition] = useTransition();

  function toggle(emoji: string) {
    if (!isAuthenticated || pending) return;
    startTransition(() => toggleReactionAction(listingId, emoji));
  }

  return (
    <div className="flex flex-wrap gap-2">
      {emojis.map((emoji) => {
        const c = counts[emoji] ?? { count: 0, userReacted: false };
        return (
          <button
            key={emoji}
            type="button"
            onClick={() => toggle(emoji)}
            disabled={!isAuthenticated || pending}
            aria-pressed={c.userReacted}
            aria-label={`React with ${emoji}`}
            className={`px-3 py-1 rounded-full border text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
              c.userReacted
                ? "bg-primary/15 border-primary"
                : "border-border hover:bg-muted"
            }`}
          >
            <span className="text-base mr-1">{emoji}</span>
            {c.count > 0 ? (
              <span className="text-muted-foreground">{c.count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
