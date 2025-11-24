import { pgTable, text, integer, serial, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Vehicles table
export const vehicles = pgTable("vehicles", {
  id: serial("id").primaryKey(),
  year: integer("year").notNull(),
  make: text("make").notNull(),
  model: text("model").notNull(),
  trim: text("trim").notNull(),
  type: text("type").notNull(), // SUV, Truck, Sedan, etc.
  price: integer("price").notNull(),
  odometer: integer("odometer").notNull(),
  images: text("images").array().notNull(), // Multiple images from detail page
  badges: text("badges").array().notNull(),
  location: text("location").notNull(), // Vancouver, Burnaby
  dealership: text("dealership").notNull(), // Boundary Hyundai Vancouver, Olympic Hyundai Vancouver, Kia Vancouver
  description: text("description").notNull(),
  fullPageContent: text("full_page_content"), // Full page content for AI description generation
  vin: text("vin"), // VIN number
  stockNumber: text("stock_number"), // Stock # from dealership
  cargurusPrice: integer("cargurus_price"), // Price on CarGurus (for comparison)
  cargurusUrl: text("cargurus_url"), // Link to CarGurus listing
  dealRating: text("deal_rating"), // CarGurus deal rating (Great Deal, Good Deal, etc.)
  videoUrl: text("video_url"), // Generated video URL from Gemini Veo
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertVehicleSchema = createInsertSchema(vehicles).omit({
  id: true,
  createdAt: true,
});

export type InsertVehicle = z.infer<typeof insertVehicleSchema>;
export type Vehicle = typeof vehicles.$inferSelect;

// View tracking table
export const vehicleViews = pgTable("vehicle_views", {
  id: serial("id").primaryKey(),
  vehicleId: integer("vehicle_id").notNull().references(() => vehicles.id),
  sessionId: text("session_id").notNull(), // For remarketing tracking
  viewedAt: timestamp("viewed_at").defaultNow().notNull(),
});

export const insertVehicleViewSchema = createInsertSchema(vehicleViews).omit({
  id: true,
  viewedAt: true,
});

export type InsertVehicleView = z.infer<typeof insertVehicleViewSchema>;
export type VehicleView = typeof vehicleViews.$inferSelect;

// Facebook pages connected by sales team
export const facebookPages = pgTable("facebook_pages", {
  id: serial("id").primaryKey(),
  pageName: text("page_name").notNull(),
  pageId: text("page_id").notNull().unique(),
  accessToken: text("access_token"), // Optional - for future OAuth integration
  isActive: boolean("is_active").notNull().default(true),
  selectedTemplate: text("selected_template").notNull().default('modern'),
  connectedAt: timestamp("connected_at").defaultNow().notNull(),
});

export const insertFacebookPageSchema = createInsertSchema(facebookPages).omit({
  id: true,
  connectedAt: true,
});

export type InsertFacebookPage = z.infer<typeof insertFacebookPageSchema>;
export type FacebookPage = typeof facebookPages.$inferSelect;

// Priority inventory for each Facebook page
export const pagePriorityVehicles = pgTable("page_priority_vehicles", {
  id: serial("id").primaryKey(),
  pageId: integer("page_id").notNull().references(() => facebookPages.id),
  vehicleId: integer("vehicle_id").notNull().references(() => vehicles.id),
  priority: integer("priority").notNull(), // Order for posting
});

export const insertPagePriorityVehicleSchema = createInsertSchema(pagePriorityVehicles).omit({
  id: true,
});

export type InsertPagePriorityVehicle = z.infer<typeof insertPagePriorityVehicleSchema>;
export type PagePriorityVehicle = typeof pagePriorityVehicles.$inferSelect;

// GoHighLevel configuration
export const ghlConfig = pgTable("ghl_config", {
  id: serial("id").primaryKey(),
  apiKey: text("api_key").notNull(), // GHL API access token
  locationId: text("location_id").notNull(), // GHL location ID
  isActive: boolean("is_active").notNull().default(true),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertGhlConfigSchema = createInsertSchema(ghlConfig).omit({
  id: true,
  updatedAt: true,
});

export type InsertGhlConfig = z.infer<typeof insertGhlConfigSchema>;
export type GhlConfig = typeof ghlConfig.$inferSelect;

// GHL Webhook configuration for SMS handoff
export const ghlWebhookConfig = pgTable("ghl_webhook_config", {
  id: serial("id").primaryKey(),
  webhookUrl: text("webhook_url").notNull(), // GHL inbound webhook URL
  webhookName: text("webhook_name").notNull(), // Descriptive name
  isActive: boolean("is_active").notNull().default(true),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertGhlWebhookConfigSchema = createInsertSchema(ghlWebhookConfig).omit({
  id: true,
  updatedAt: true,
});

export type InsertGhlWebhookConfig = z.infer<typeof insertGhlWebhookConfigSchema>;
export type GhlWebhookConfig = typeof ghlWebhookConfig.$inferSelect;

// AI prompt templates for vehicle descriptions
export const aiPromptTemplates = pgTable("ai_prompt_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(), // e.g., "Vehicle Description", "Short Description"
  promptText: text("prompt_text").notNull(), // The actual ChatGPT prompt
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertAiPromptTemplateSchema = createInsertSchema(aiPromptTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAiPromptTemplate = z.infer<typeof insertAiPromptTemplateSchema>;
export type AiPromptTemplate = typeof aiPromptTemplates.$inferSelect;

// Chat conversations for analytics and training
export const chatConversations = pgTable("chat_conversations", {
  id: serial("id").primaryKey(),
  category: text("category").notNull(), // 'test-drive', 'get-approved', 'value-trade', 'reserve', 'general'
  vehicleId: integer("vehicle_id").references(() => vehicles.id),
  vehicleName: text("vehicle_name"), // e.g., "2024 Toyota Camry"
  messages: text("messages").notNull(), // JSON string of message array
  sessionId: text("session_id").notNull(),
  handoffRequested: boolean("handoff_requested").notNull().default(false), // User requested SMS handoff
  handoffPhone: text("handoff_phone"), // Phone number for SMS handoff
  handoffSent: boolean("handoff_sent").notNull().default(false), // Successfully sent to GHL
  handoffSentAt: timestamp("handoff_sent_at"), // When handoff was sent
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertChatConversationSchema = createInsertSchema(chatConversations).omit({
  id: true,
  createdAt: true,
});

export type InsertChatConversation = z.infer<typeof insertChatConversationSchema>;
export type ChatConversation = typeof chatConversations.$inferSelect;

// Chat prompts for different scenarios
export const chatPrompts = pgTable("chat_prompts", {
  id: serial("id").primaryKey(),
  scenario: text("scenario").notNull().unique(), // 'test-drive', 'get-approved', 'value-trade', 'reserve', 'general'
  systemPrompt: text("system_prompt").notNull(), // The system/instruction prompt for ChatGPT
  greeting: text("greeting").notNull(), // Initial greeting message
  isActive: boolean("is_active").notNull().default(true),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertChatPromptSchema = createInsertSchema(chatPrompts).omit({
  id: true,
  updatedAt: true,
});

export type InsertChatPrompt = z.infer<typeof insertChatPromptSchema>;
export type ChatPrompt = typeof chatPrompts.$inferSelect;

// Users table with role-based access
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull(), // 'master', 'manager', 'salesperson'
  isActive: boolean("is_active").notNull().default(true),
  createdBy: integer("created_by"), // Master user who created this account
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Admin configuration (legacy - will migrate to users table)
export const adminConfig = pgTable("admin_config", {
  id: serial("id").primaryKey(),
  passwordHash: text("password_hash").notNull(), // Hashed master password
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertAdminConfigSchema = createInsertSchema(adminConfig).omit({
  id: true,
  updatedAt: true,
});

export type InsertAdminConfig = z.infer<typeof insertAdminConfigSchema>;
export type AdminConfig = typeof adminConfig.$inferSelect;
