// Fields needed to build the share message — satisfied by both the full
// listing row and the list/card item shape.
export type WhatsAppShareInput = {
  title: string | null;
  address: string | null;
  priceUsd: number | null;
  bedrooms: string | null;
  bathrooms: string | null;
  squareFeet: number | null;
};

// Click-to-chat URL that opens the sender's own WhatsApp with a pre-built
// message. The only link included is the in-app listing URL (recipients open
// it in the app; the original source is visible there if they want it).
export function buildWhatsAppShareUrl(
  l: WhatsAppShareInput,
  appUrl: string,
): string {
  const lines: string[] = [l.title ?? l.address ?? "Listing"];
  const stats: string[] = [];
  if (l.priceUsd != null) stats.push(`$${l.priceUsd.toLocaleString("en-US")}/mo`);
  if (l.bedrooms) stats.push(`${l.bedrooms} bd`);
  if (l.bathrooms) stats.push(`${l.bathrooms} ba`);
  if (l.squareFeet != null) {
    stats.push(`${l.squareFeet.toLocaleString("en-US")} sqft`);
  }
  if (stats.length > 0) lines.push(stats.join(" · "));
  if (l.address && l.address !== lines[0]) lines.push(`📍 ${l.address}`);
  if (appUrl) lines.push(appUrl);
  return `https://wa.me/?text=${encodeURIComponent(lines.join("\n"))}`;
}
