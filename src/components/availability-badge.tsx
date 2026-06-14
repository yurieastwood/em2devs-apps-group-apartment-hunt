type Props = {
  availability: string;
  size?: "default" | "compact";
};

export function AvailabilityBadge({ availability, size = "default" }: Props) {
  const base =
    size === "compact"
      ? "inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-medium uppercase tracking-wide shrink-0"
      : "inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-medium";

  if (availability === "available") {
    return (
      <span
        className={`${base} bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30`}
      >
        Available
      </span>
    );
  }
  if (availability === "unavailable") {
    return (
      <span
        className={`${base} bg-destructive/10 text-destructive border-destructive/30`}
      >
        Unavailable
      </span>
    );
  }
  return null;
}
