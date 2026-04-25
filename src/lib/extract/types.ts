export type ListingPhoto = {
  url: string;
  width?: number;
  height?: number;
};

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
  photos: ListingPhoto[];
  raw: unknown;
};
