import {
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const listings = pgTable(
  "listings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerClerkUserId: text("owner_clerk_user_id").notNull(),
    sourceUrl: text("source_url").notNull(),
    sourceHost: text("source_host").notNull(),
    sourceListingId: text("source_listing_id"),
    title: text("title"),
    address: text("address"),
    city: text("city"),
    state: text("state"),
    zipCode: text("zip_code"),
    latitude: numeric("latitude", { precision: 9, scale: 6 }),
    longitude: numeric("longitude", { precision: 9, scale: 6 }),
    bedrooms: numeric("bedrooms", { precision: 4, scale: 1 }),
    bathrooms: numeric("bathrooms", { precision: 4, scale: 1 }),
    squareFeet: integer("square_feet"),
    priceUsd: integer("price_usd"),
    description: text("description"),
    raw: jsonb("raw"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    sourceUrlIdx: uniqueIndex("listings_source_url_idx").on(t.sourceUrl),
    ownerIdx: index("listings_owner_idx").on(t.ownerClerkUserId),
  }),
);

export const listingPhotos = pgTable(
  "listing_photos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull(),
    r2Key: text("r2_key").notNull(),
    originalUrl: text("original_url").notNull(),
    contentType: text("content_type").notNull(),
    width: integer("width"),
    height: integer("height"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    listingOrderIdx: uniqueIndex("listing_photos_listing_order_idx").on(
      t.listingId,
      t.sortOrder,
    ),
  }),
);

export type Listing = typeof listings.$inferSelect;
export type NewListing = typeof listings.$inferInsert;
export type ListingPhoto = typeof listingPhotos.$inferSelect;
export type NewListingPhoto = typeof listingPhotos.$inferInsert;
