export type ListingPhoto = {
  url: string;
  width?: number;
  height?: number;
};

export type ParsedSchool = {
  name: string;
  schoolType?: string | null;
  level?: string | null;
  gradeRange?: string | null;
  rating?: number | null;
  distanceMiles?: number | null;
  greatSchoolsUrl?: string | null;
  enrollment?: number | null;
  isAssigned?: boolean | null;
  lat?: number | null;
  lng?: number | null;
};

export type Availability = "available" | "unavailable" | "unknown";

export type ParsedListing = {
  sourceUrl: string;
  sourceHost: string;
  sourceListingId: string | null;
  title: string | null;
  address: string | null;
  streetAddress: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  latitude: number | null;
  longitude: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  squareFeet: number | null;
  priceUsd: number | null;
  description: string | null;
  neighborhood: string | null;
  availability: Availability;
  photos: ListingPhoto[];
  schools: ParsedSchool[];
  raw: unknown;
};
