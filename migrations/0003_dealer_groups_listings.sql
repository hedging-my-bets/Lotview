CREATE TABLE "dealer_groups" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "dealer_groups_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "dealerships" ADD COLUMN "dealer_group_id" integer;
--> statement-breakpoint
ALTER TABLE "dealerships" ADD CONSTRAINT "dealerships_dealer_group_id_dealer_groups_id_fk" FOREIGN KEY ("dealer_group_id") REFERENCES "public"."dealer_groups"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE TABLE "rooftops" (
	"id" serial PRIMARY KEY NOT NULL,
	"dealership_id" integer NOT NULL,
	"dealer_group_id" integer,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"address" text,
	"city" text,
	"province" text,
	"postal_code" text,
	"phone" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rooftop_memberships" (
	"id" serial PRIMARY KEY NOT NULL,
	"dealership_id" integer NOT NULL,
	"rooftop_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"role" text DEFAULT 'rep' NOT NULL,
	"can_post" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "dealer_group_id" integer;
--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "rooftop_id" integer;
--> statement-breakpoint
CREATE TABLE "listing_bundles" (
	"id" serial PRIMARY KEY NOT NULL,
	"dealership_id" integer NOT NULL,
	"rooftop_id" integer,
	"vehicle_id" integer NOT NULL,
	"title" text,
	"description" text,
	"price" integer,
	"features" text,
	"hashtags" text,
	"image_urls" text[],
	"status" text DEFAULT 'draft' NOT NULL,
	"created_by_id" integer,
	"updated_by_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "listing_instances" (
	"id" serial PRIMARY KEY NOT NULL,
	"dealership_id" integer NOT NULL,
	"dealer_group_id" integer,
	"rooftop_id" integer,
	"vehicle_id" integer NOT NULL,
	"bundle_id" integer,
	"vin" text NOT NULL,
	"channel" text DEFAULT 'facebook_marketplace' NOT NULL,
	"poster_type" text DEFAULT 'personal' NOT NULL,
	"listing_url" text,
	"external_listing_id" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"posted_at" timestamp,
	"posted_by_id" integer,
	"removed_at" timestamp,
	"removed_by_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rooftops" ADD CONSTRAINT "rooftops_dealership_id_dealerships_id_fk" FOREIGN KEY ("dealership_id") REFERENCES "public"."dealerships"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "rooftops" ADD CONSTRAINT "rooftops_dealer_group_id_dealer_groups_id_fk" FOREIGN KEY ("dealer_group_id") REFERENCES "public"."dealer_groups"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "rooftop_memberships" ADD CONSTRAINT "rooftop_memberships_dealership_id_dealerships_id_fk" FOREIGN KEY ("dealership_id") REFERENCES "public"."dealerships"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "rooftop_memberships" ADD CONSTRAINT "rooftop_memberships_rooftop_id_rooftops_id_fk" FOREIGN KEY ("rooftop_id") REFERENCES "public"."rooftops"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "rooftop_memberships" ADD CONSTRAINT "rooftop_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_dealer_group_id_dealer_groups_id_fk" FOREIGN KEY ("dealer_group_id") REFERENCES "public"."dealer_groups"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_rooftop_id_rooftops_id_fk" FOREIGN KEY ("rooftop_id") REFERENCES "public"."rooftops"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "listing_bundles" ADD CONSTRAINT "listing_bundles_dealership_id_dealerships_id_fk" FOREIGN KEY ("dealership_id") REFERENCES "public"."dealerships"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "listing_bundles" ADD CONSTRAINT "listing_bundles_rooftop_id_rooftops_id_fk" FOREIGN KEY ("rooftop_id") REFERENCES "public"."rooftops"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "listing_bundles" ADD CONSTRAINT "listing_bundles_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "listing_bundles" ADD CONSTRAINT "listing_bundles_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "listing_bundles" ADD CONSTRAINT "listing_bundles_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "listing_instances" ADD CONSTRAINT "listing_instances_dealership_id_dealerships_id_fk" FOREIGN KEY ("dealership_id") REFERENCES "public"."dealerships"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "listing_instances" ADD CONSTRAINT "listing_instances_dealer_group_id_dealer_groups_id_fk" FOREIGN KEY ("dealer_group_id") REFERENCES "public"."dealer_groups"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "listing_instances" ADD CONSTRAINT "listing_instances_rooftop_id_rooftops_id_fk" FOREIGN KEY ("rooftop_id") REFERENCES "public"."rooftops"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "listing_instances" ADD CONSTRAINT "listing_instances_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "listing_instances" ADD CONSTRAINT "listing_instances_bundle_id_listing_bundles_id_fk" FOREIGN KEY ("bundle_id") REFERENCES "public"."listing_bundles"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "listing_instances" ADD CONSTRAINT "listing_instances_posted_by_id_users_id_fk" FOREIGN KEY ("posted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "listing_instances" ADD CONSTRAINT "listing_instances_removed_by_id_users_id_fk" FOREIGN KEY ("removed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "listing_instances_active_vin_unique" ON "listing_instances" ("dealership_id","vin") WHERE "listing_instances"."is_active" = true;
