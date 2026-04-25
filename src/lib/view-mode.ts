export const VIEW_MODE_COOKIE = "listings_view_mode";

export type ViewMode = "cards" | "list";

export function isViewMode(v: unknown): v is ViewMode {
  return v === "cards" || v === "list";
}
