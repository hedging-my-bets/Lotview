CREATE TABLE "facebook_business_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"dealership_id" integer NOT NULL,
	"business_id" text NOT NULL,
	"business_name" text,
	"system_user_id" text,
	"system_user_token" text,
	"token_expires_at" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"connected_by_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "facebook_business_accounts_dealership_id_business_id_unique" UNIQUE("dealership_id","business_id")
);
--> statement-breakpoint
ALTER TABLE "facebook_business_accounts" ADD CONSTRAINT "facebook_business_accounts_dealership_id_dealerships_id_fk" FOREIGN KEY ("dealership_id") REFERENCES "public"."dealerships"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "facebook_business_accounts" ADD CONSTRAINT "facebook_business_accounts_connected_by_id_users_id_fk" FOREIGN KEY ("connected_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "messenger_conversations" ALTER COLUMN "facebook_account_id" DROP NOT NULL;
