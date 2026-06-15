CREATE TABLE "comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"author_clerk_user_id" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "home_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_clerk_user_id" text NOT NULL,
	"org_id" text,
	"home_address" text NOT NULL,
	"home_lat" numeric(9, 6) NOT NULL,
	"home_lng" numeric(9, 6) NOT NULL,
	"safety_raw" numeric,
	"safety_breakdown" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "labels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_clerk_user_id" text NOT NULL,
	"org_id" text,
	"name" text NOT NULL,
	"color" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "listing_changes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"field" text NOT NULL,
	"old_value" text,
	"new_value" text,
	"source" text NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "listing_labels" (
	"listing_id" uuid NOT NULL,
	"label_id" uuid NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "listing_labels_listing_id_label_id_pk" PRIMARY KEY("listing_id","label_id")
);
--> statement-breakpoint
CREATE TABLE "listing_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"sort_order" integer NOT NULL,
	"r2_key" text NOT NULL,
	"thumb_r2_key" text,
	"original_url" text NOT NULL,
	"content_type" text NOT NULL,
	"width" integer,
	"height" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "listing_poi_distances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"poi_id" uuid NOT NULL,
	"duration_seconds" integer,
	"distance_meters" integer,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "listing_schools" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"sort_order" integer NOT NULL,
	"name" text NOT NULL,
	"school_type" text,
	"level" text,
	"grade_range" text,
	"rating" integer,
	"distance_miles" numeric(6, 3),
	"great_schools_url" text,
	"enrollment" integer,
	"is_assigned" boolean,
	"lat" numeric(9, 6),
	"lng" numeric(9, 6),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_clerk_user_id" text NOT NULL,
	"org_id" text,
	"source_url" text NOT NULL,
	"source_host" text NOT NULL,
	"source_listing_id" text,
	"title" text,
	"address" text,
	"city" text,
	"state" text,
	"zip_code" text,
	"latitude" numeric(9, 6),
	"longitude" numeric(9, 6),
	"bedrooms" numeric(4, 1),
	"bathrooms" numeric(4, 1),
	"square_feet" integer,
	"price_usd" integer,
	"priority" integer,
	"contact_status" text,
	"description" text,
	"neighborhood" text,
	"district" text,
	"units" jsonb,
	"headline_locked" boolean DEFAULT false NOT NULL,
	"safety_score" integer,
	"safety_breakdown" jsonb,
	"deleted_at" timestamp with time zone,
	"availability" text DEFAULT 'unknown' NOT NULL,
	"last_checked_at" timestamp with time zone,
	"last_check_error" text,
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "points_of_interest" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_clerk_user_id" text NOT NULL,
	"org_id" text,
	"label" text NOT NULL,
	"address" text NOT NULL,
	"color" text,
	"lat" numeric(9, 6) NOT NULL,
	"lng" numeric(9, 6) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"author_clerk_user_id" text NOT NULL,
	"emoji" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_changes" ADD CONSTRAINT "listing_changes_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_labels" ADD CONSTRAINT "listing_labels_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_labels" ADD CONSTRAINT "listing_labels_label_id_labels_id_fk" FOREIGN KEY ("label_id") REFERENCES "public"."labels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_photos" ADD CONSTRAINT "listing_photos_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_poi_distances" ADD CONSTRAINT "listing_poi_distances_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_poi_distances" ADD CONSTRAINT "listing_poi_distances_poi_id_points_of_interest_id_fk" FOREIGN KEY ("poi_id") REFERENCES "public"."points_of_interest"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_schools" ADD CONSTRAINT "listing_schools_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "comments_listing_idx" ON "comments" USING btree ("listing_id","created_at");--> statement-breakpoint
CREATE INDEX "home_settings_scope_idx" ON "home_settings" USING btree ("owner_clerk_user_id","org_id");--> statement-breakpoint
CREATE INDEX "labels_scope_idx" ON "labels" USING btree ("owner_clerk_user_id","org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "labels_scope_name_idx" ON "labels" USING btree ("owner_clerk_user_id","org_id","name");--> statement-breakpoint
CREATE INDEX "listing_changes_listing_idx" ON "listing_changes" USING btree ("listing_id","changed_at");--> statement-breakpoint
CREATE INDEX "listing_changes_changed_at_idx" ON "listing_changes" USING btree ("changed_at");--> statement-breakpoint
CREATE INDEX "listing_labels_label_idx" ON "listing_labels" USING btree ("label_id");--> statement-breakpoint
CREATE UNIQUE INDEX "listing_photos_listing_order_idx" ON "listing_photos" USING btree ("listing_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "listing_poi_pair_idx" ON "listing_poi_distances" USING btree ("listing_id","poi_id");--> statement-breakpoint
CREATE INDEX "listing_poi_poi_idx" ON "listing_poi_distances" USING btree ("poi_id");--> statement-breakpoint
CREATE INDEX "listing_schools_listing_idx" ON "listing_schools" USING btree ("listing_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "listings_source_url_idx" ON "listings" USING btree ("source_url");--> statement-breakpoint
CREATE INDEX "listings_owner_idx" ON "listings" USING btree ("owner_clerk_user_id");--> statement-breakpoint
CREATE INDEX "listings_org_idx" ON "listings" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "pois_scope_idx" ON "points_of_interest" USING btree ("owner_clerk_user_id","org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "reactions_uniq_idx" ON "reactions" USING btree ("listing_id","author_clerk_user_id","emoji");--> statement-breakpoint
CREATE INDEX "reactions_listing_idx" ON "reactions" USING btree ("listing_id");