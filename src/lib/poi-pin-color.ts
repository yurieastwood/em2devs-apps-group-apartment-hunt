// Palette of pin colors for POI markers. Each entry maps to the three CSS
// colors `<Pin>` accepts: background (teardrop fill), borderColor (outline +
// stem), and glyphColor (interior icon/text). Default = green to match the
// pre-customization look so legacy rows render unchanged.

export type PoiPinColor = {
  name: string;
  background: string;
  border: string;
  glyph: string;
};

const PALETTE: PoiPinColor[] = [
  { name: "green", background: "#16a34a", border: "#15803d", glyph: "#ffffff" },
  { name: "blue", background: "#2563eb", border: "#1e40af", glyph: "#ffffff" },
  { name: "red", background: "#dc2626", border: "#991b1b", glyph: "#ffffff" },
  { name: "amber", background: "#f59e0b", border: "#b45309", glyph: "#1f2937" },
  { name: "purple", background: "#9333ea", border: "#6b21a8", glyph: "#ffffff" },
  { name: "pink", background: "#ec4899", border: "#9d174d", glyph: "#ffffff" },
  { name: "teal", background: "#0d9488", border: "#115e59", glyph: "#ffffff" },
  { name: "gray", background: "#475569", border: "#1e293b", glyph: "#ffffff" },
];

const BY_NAME = new Map(PALETTE.map((c) => [c.name, c]));

export const POI_PIN_COLORS: ReadonlyArray<PoiPinColor> = PALETTE;
export const DEFAULT_POI_PIN_COLOR: PoiPinColor = PALETTE[0];

export function poiPinColor(name: string | null | undefined): PoiPinColor {
  if (!name) return DEFAULT_POI_PIN_COLOR;
  return BY_NAME.get(name) ?? DEFAULT_POI_PIN_COLOR;
}

export function isValidPoiColorName(name: string): boolean {
  return BY_NAME.has(name);
}
