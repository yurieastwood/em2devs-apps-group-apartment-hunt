// Pure constants/helpers for manually-entered listings, kept free of any heavy
// or native imports (e.g. sharp) so they can be imported by render routes like
// the listing detail page without pulling image-processing code into that
// route's serverless bundle.

export const MANUAL_SOURCE_HOST = "manual.local";
export const MANUAL_SOURCE_SCHEME = "manual:";

export function isManualListing(sourceHost: string | null): boolean {
  return sourceHost === MANUAL_SOURCE_HOST;
}
