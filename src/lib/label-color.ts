// Maps a label color token to Tailwind classes for chip rendering.
// Stored color values are tokens, not raw CSS — keeps the palette consistent
// and lets us re-style globally if the theme changes.

export const LABEL_COLORS = [
  "red",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
  "pink",
  "gray",
] as const;

export type LabelColor = (typeof LABEL_COLORS)[number];

const CHIP_CLASSES: Record<LabelColor, string> = {
  red: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/40",
  orange:
    "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/40",
  yellow:
    "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 border-yellow-500/40",
  green:
    "bg-green-500/15 text-green-700 dark:text-green-300 border-green-500/40",
  blue: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/40",
  purple:
    "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/40",
  pink: "bg-pink-500/15 text-pink-700 dark:text-pink-300 border-pink-500/40",
  gray: "bg-muted text-muted-foreground border-border",
};

export function labelChipClasses(color: string | null): string {
  const key = (color as LabelColor) ?? "gray";
  return CHIP_CLASSES[key] ?? CHIP_CLASSES.gray;
}
