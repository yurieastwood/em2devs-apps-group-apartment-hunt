import {
  boolean,
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
    orgId: text("org_id"),
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
    orgIdx: index("listings_org_idx").on(t.orgId),
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

export const comments = pgTable(
  "comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    authorClerkUserId: text("author_clerk_user_id").notNull(),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    listingIdx: index("comments_listing_idx").on(t.listingId, t.createdAt),
  }),
);

export const reactions = pgTable(
  "reactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    authorClerkUserId: text("author_clerk_user_id").notNull(),
    emoji: text("emoji").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    uniqIdx: uniqueIndex("reactions_uniq_idx").on(
      t.listingId,
      t.authorClerkUserId,
      t.emoji,
    ),
    listingIdx: index("reactions_listing_idx").on(t.listingId),
  }),
);

export const listingSchools = pgTable(
  "listing_schools",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull(),
    name: text("name").notNull(),
    schoolType: text("school_type"),
    level: text("level"),
    gradeRange: text("grade_range"),
    rating: integer("rating"),
    distanceMiles: numeric("distance_miles", { precision: 6, scale: 3 }),
    greatSchoolsUrl: text("great_schools_url"),
    enrollment: integer("enrollment"),
    isAssigned: boolean("is_assigned"),
    lat: numeric("lat", { precision: 9, scale: 6 }),
    lng: numeric("lng", { precision: 9, scale: 6 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    listingIdx: index("listing_schools_listing_idx").on(
      t.listingId,
      t.sortOrder,
    ),
  }),
);

export const pointsOfInterest = pgTable(
  "points_of_interest",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerClerkUserId: text("owner_clerk_user_id").notNull(),
    label: text("label").notNull(),
    address: text("address").notNull(),
    lat: numeric("lat", { precision: 9, scale: 6 }).notNull(),
    lng: numeric("lng", { precision: 9, scale: 6 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    ownerIdx: index("pois_owner_idx").on(t.ownerClerkUserId),
  }),
);

export const listingPoiDistances = pgTable(
  "listing_poi_distances",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    poiId: uuid("poi_id")
      .notNull()
      .references(() => pointsOfInterest.id, { onDelete: "cascade" }),
    durationSeconds: integer("duration_seconds"),
    distanceMeters: integer("distance_meters"),
    computedAt: timestamp("computed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    pairUnique: uniqueIndex("listing_poi_pair_idx").on(t.listingId, t.poiId),
    poiIdx: index("listing_poi_poi_idx").on(t.poiId),
  }),
);

export const userSettings = pgTable("user_settings", {
  clerkUserId: text("clerk_user_id").primaryKey(),
  homeAddress: text("home_address"),
  homeLat: numeric("home_lat", { precision: 9, scale: 6 }),
  homeLng: numeric("home_lng", { precision: 9, scale: 6 }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Listing = typeof listings.$inferSelect;
export type NewListing = typeof listings.$inferInsert;
export type ListingPhoto = typeof listingPhotos.$inferSelect;
export type NewListingPhoto = typeof listingPhotos.$inferInsert;
export type Comment = typeof comments.$inferSelect;
export type NewComment = typeof comments.$inferInsert;
export type Reaction = typeof reactions.$inferSelect;
export type NewReaction = typeof reactions.$inferInsert;
export type UserSettings = typeof userSettings.$inferSelect;
export type NewUserSettings = typeof userSettings.$inferInsert;
export type ListingSchool = typeof listingSchools.$inferSelect;
export type NewListingSchool = typeof listingSchools.$inferInsert;
export type PointOfInterest = typeof pointsOfInterest.$inferSelect;
export type NewPointOfInterest = typeof pointsOfInterest.$inferInsert;
export type ListingPoiDistance = typeof listingPoiDistances.$inferSelect;
export type NewListingPoiDistance = typeof listingPoiDistances.$inferInsert;
