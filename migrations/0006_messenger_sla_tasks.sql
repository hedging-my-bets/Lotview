ALTER TABLE "crm_tasks" ADD COLUMN "messenger_conversation_id" integer;
--> statement-breakpoint
ALTER TABLE "crm_tasks" ADD CONSTRAINT "crm_tasks_messenger_conversation_id_messenger_conversations_id_fk" FOREIGN KEY ("messenger_conversation_id") REFERENCES "public"."messenger_conversations"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "crm_tasks_messenger_conversation_id_idx" ON "crm_tasks" ("messenger_conversation_id");
