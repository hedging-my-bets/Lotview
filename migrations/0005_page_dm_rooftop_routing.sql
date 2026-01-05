ALTER TABLE "dealerships" ADD COLUMN "page_dm_link" text;
--> statement-breakpoint
ALTER TABLE "facebook_pages" ADD COLUMN "rooftop_id" integer;
--> statement-breakpoint
ALTER TABLE "facebook_pages" ADD COLUMN "page_dm_link" text;
--> statement-breakpoint
ALTER TABLE "messenger_conversations" ADD COLUMN "rooftop_id" integer;
--> statement-breakpoint
ALTER TABLE "facebook_pages" ADD CONSTRAINT "facebook_pages_rooftop_id_rooftops_id_fk" FOREIGN KEY ("rooftop_id") REFERENCES "public"."rooftops"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "messenger_conversations" ADD CONSTRAINT "messenger_conversations_rooftop_id_rooftops_id_fk" FOREIGN KEY ("rooftop_id") REFERENCES "public"."rooftops"("id") ON DELETE set null ON UPDATE no action;
