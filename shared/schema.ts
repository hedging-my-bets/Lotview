import { pgTable, text, integer, serial, timestamp, boolean, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { sql } from "drizzle-orm";

// ====== MULTI-TENANT CORE TABLES ======

// Dealerships table - Each dealership is a tenant
export const dealerships = pgTable("dealerships", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(), // e.g., "Olympic Auto Group"
  slug: text("slug").notNull().unique(), // URL-safe identifier (e.g., "olympic-auto")
  subdomain: text("subdomain").unique(), // For subdomain routing (e.g., "olympic")
  logo: text("logo"), // Logo URL
  brandColors: text("brand_colors"), // JSON object with primary/secondary colors
  status: text("status").notNull().default('active'), // active, suspended, cancelled
  trialEndsAt: timestamp("trial_ends_at"), // 14-day trial end date
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertDealershipSchema = createInsertSchema(dealerships).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertDealership = z.infer<typeof insertDealershipSchema>;
export type Dealership = typeof dealerships.$inferSelect;

// Dealership subscriptions - Billing and plan management
export const dealershipSubscriptions = pgTable("dealership_subscriptions", {
  id: serial("id").primaryKey(),
  dealershipId: integer("dealership_id").notNull().references(() => dealerships.id, { onDelete: 'cascade' }),
  plan: text("plan").notNull().default('starter'), // starter, professional, enterprise
  status: text("status").notNull().default('trial'), // trial, active, past_due, cancelled
  currentPeriodEnd: timestamp("current_period_end"), // When current billing period ends
  stripeCustomerId: text("stripe_customer_id"), // Stripe customer ID
  stripeSubscriptionId: text("stripe_subscription_id"), // Stripe subscription ID
  monthlyPrice: integer("monthly_price"), // Price in cents
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertDealershipSubscriptionSchema = createInsertSchema(dealershipSubscriptions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertDealershipSubscription = z.infer<typeof insertDealershipSubscriptionSchema>;
export type DealershipSubscription = typeof dealershipSubscriptions.$inferSelect;

// Dealership API keys - Master user manages these per dealership
export const dealershipApiKeys = pgTable("dealership_api_keys", {
  id: serial("id").primaryKey(),
  dealershipId: integer("dealership_id").notNull().references(() => dealerships.id, { onDelete: 'cascade' }),
  marketcheckKey: text("marketcheck_key"), // MarketCheck API key
  apifyToken: text("apify_token"), // Apify API token
  apifyActorId: text("apify_actor_id"), // Apify actor ID for AutoTrader scraper
  geminiApiKey: text("gemini_api_key"), // Google Gemini Veo API key
  ghlApiKey: text("ghl_api_key"), // GoHighLevel API key
  ghlLocationId: text("ghl_location_id"), // GoHighLevel location/sub-account ID
  facebookAppId: text("facebook_app_id"), // Facebook App ID (shared or per-dealership)
  facebookAppSecret: text("facebook_app_secret"), // Facebook App Secret
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertDealershipApiKeysSchema = createInsertSchema(dealershipApiKeys).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertDealershipApiKeys = z.infer<typeof insertDealershipApiKeysSchema>;
export type DealershipApiKeys = typeof dealershipApiKeys.$inferSelect;

// ====== APPLICATION TABLES (Multi-Tenant) ======

// Vehicles table
export const vehicles = pgTable("vehicles", {
  id: serial("id").primaryKey(),
  dealershipId: integer("dealership_id").notNull().references(() => dealerships.id, { onDelete: 'cascade' }),
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
  dealershipId: integer("dealership_id").notNull().references(() => dealerships.id, { onDelete: 'cascade' }),
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

// Facebook pages connected by sales team (LEGACY - being replaced by facebookAccounts)
export const facebookPages = pgTable("facebook_pages", {
  id: serial("id").primaryKey(),
  dealershipId: integer("dealership_id").notNull().references(() => dealerships.id, { onDelete: 'cascade' }),
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

// Priority inventory for each Facebook page (LEGACY - being replaced by postingQueue)
export const pagePriorityVehicles = pgTable("page_priority_vehicles", {
  id: serial("id").primaryKey(),
  dealershipId: integer("dealership_id").notNull().references(() => dealerships.id, { onDelete: 'cascade' }),
  pageId: integer("page_id").notNull().references(() => facebookPages.id),
  vehicleId: integer("vehicle_id").notNull().references(() => vehicles.id),
  priority: integer("priority").notNull(), // Order for posting
});

export const insertPagePriorityVehicleSchema = createInsertSchema(pagePriorityVehicles).omit({
  id: true,
});

export type InsertPagePriorityVehicle = z.infer<typeof insertPagePriorityVehicleSchema>;
export type PagePriorityVehicle = typeof pagePriorityVehicles.$inferSelect;

// GoHighLevel configuration (LEGACY - being moved to dealershipApiKeys)
export const ghlConfig = pgTable("ghl_config", {
  id: serial("id").primaryKey(),
  dealershipId: integer("dealership_id").notNull().references(() => dealerships.id, { onDelete: 'cascade' }),
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
  dealershipId: integer("dealership_id").notNull().references(() => dealerships.id, { onDelete: 'cascade' }),
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
  dealershipId: integer("dealership_id").notNull().references(() => dealerships.id, { onDelete: 'cascade' }),
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
  dealershipId: integer("dealership_id").notNull().references(() => dealerships.id, { onDelete: 'cascade' }),
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
  dealershipId: integer("dealership_id").notNull().references(() => dealerships.id, { onDelete: 'cascade' }),
  scenario: text("scenario").notNull(), // 'test-drive', 'get-approved', 'value-trade', 'reserve', 'general'
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
  dealershipId: integer("dealership_id").references(() => dealerships.id, { onDelete: 'cascade' }), // NULL for master users who manage all dealerships
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

// Financing rules - Credit score tiers
export const creditScoreTiers = pgTable("credit_score_tiers", {
  id: serial("id").primaryKey(),
  dealershipId: integer("dealership_id").notNull().references(() => dealerships.id, { onDelete: 'cascade' }),
  tierName: text("tier_name").notNull(), // e.g., "Excellent", "Good", "Fair", "Poor"
  minScore: integer("min_score").notNull(),
  maxScore: integer("max_score").notNull(),
  interestRate: integer("interest_rate").notNull(), // Stored as basis points (e.g., 575 = 5.75%)
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertCreditScoreTierSchema = createInsertSchema(creditScoreTiers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCreditScoreTier = z.infer<typeof insertCreditScoreTierSchema>;
export type CreditScoreTier = typeof creditScoreTiers.$inferSelect;

// Financing rules - Model year term eligibility
export const modelYearTerms = pgTable("model_year_terms", {
  id: serial("id").primaryKey(),
  dealershipId: integer("dealership_id").notNull().references(() => dealerships.id, { onDelete: 'cascade' }),
  minModelYear: integer("min_model_year").notNull(), // e.g., 2020
  maxModelYear: integer("max_model_year").notNull(), // e.g., 2024
  availableTerms: text("available_terms").array().notNull(), // e.g., ["36", "48", "60", "72", "84"]
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertModelYearTermSchema = createInsertSchema(modelYearTerms).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertModelYearTerm = z.infer<typeof insertModelYearTermSchema>;
export type ModelYearTerm = typeof modelYearTerms.$inferSelect;

// Facebook accounts for salespeople (up to 5 per user)
export const facebookAccounts = pgTable("facebook_accounts", {
  id: serial("id").primaryKey(),
  dealershipId: integer("dealership_id").notNull().references(() => dealerships.id, { onDelete: 'cascade' }),
  userId: integer("user_id").notNull().references(() => users.id), // Salesperson who owns this account
  accountName: text("account_name").notNull(), // Display name for the account
  facebookUserId: text("facebook_user_id"), // Facebook user ID (from OAuth)
  accessToken: text("access_token"), // Long-lived access token
  tokenExpiresAt: timestamp("token_expires_at"), // When the token expires
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertFacebookAccountSchema = createInsertSchema(facebookAccounts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertFacebookAccount = z.infer<typeof insertFacebookAccountSchema>;
export type FacebookAccount = typeof facebookAccounts.$inferSelect;

// Ad templates for Facebook Marketplace posts
export const adTemplates = pgTable("ad_templates", {
  id: serial("id").primaryKey(),
  dealershipId: integer("dealership_id").notNull().references(() => dealerships.id, { onDelete: 'cascade' }),
  userId: integer("user_id").notNull().references(() => users.id), // Salesperson who created this
  templateName: text("template_name").notNull(), // e.g., "Classic", "Premium", "Budget"
  titleTemplate: text("title_template").notNull(), // e.g., "{year} {make} {model} - ${price}"
  descriptionTemplate: text("description_template").notNull(), // Full description with variables
  isDefault: boolean("is_default").notNull().default(false), // If this is the default template
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertAdTemplateSchema = createInsertSchema(adTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAdTemplate = z.infer<typeof insertAdTemplateSchema>;
export type AdTemplate = typeof adTemplates.$inferSelect;

// Posting queue for Facebook Marketplace
export const postingQueue = pgTable("posting_queue", {
  id: serial("id").primaryKey(),
  dealershipId: integer("dealership_id").notNull().references(() => dealerships.id, { onDelete: 'cascade' }),
  userId: integer("user_id").notNull().references(() => users.id), // Salesperson
  facebookAccountId: integer("facebook_account_id").references(() => facebookAccounts.id), // Which account to use
  vehicleId: integer("vehicle_id").notNull().references(() => vehicles.id),
  templateId: integer("template_id").references(() => adTemplates.id), // Which template to use
  queueOrder: integer("queue_order").notNull(), // Position in queue (1-45)
  status: text("status").notNull().default('queued'), // 'queued', 'scheduled', 'posting', 'posted', 'failed'
  scheduledFor: timestamp("scheduled_for"), // When to post (null = use auto-scheduler)
  postedAt: timestamp("posted_at"), // When it was actually posted
  facebookPostId: text("facebook_post_id"), // Facebook Marketplace listing ID
  errorMessage: text("error_message"), // If posting failed
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertPostingQueueSchema = createInsertSchema(postingQueue).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertPostingQueue = z.infer<typeof insertPostingQueueSchema>;
export type PostingQueue = typeof postingQueue.$inferSelect;

// Posting schedule configuration (per salesperson)
export const postingSchedule = pgTable("posting_schedule", {
  id: serial("id").primaryKey(),
  dealershipId: integer("dealership_id").notNull().references(() => dealerships.id, { onDelete: 'cascade' }),
  userId: integer("user_id").notNull().references(() => users.id).unique(), // One schedule per salesperson
  startTime: text("start_time").notNull().default('09:00'), // HH:MM format
  intervalMinutes: integer("interval_minutes").notNull().default(30), // Time between posts
  isActive: boolean("is_active").notNull().default(false), // Auto-posting enabled/disabled
  lastPostedAt: timestamp("last_posted_at"), // Track when we last posted
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertPostingScheduleSchema = createInsertSchema(postingSchedule).omit({
  id: true,
  updatedAt: true,
});

export type InsertPostingSchedule = z.infer<typeof insertPostingScheduleSchema>;
export type PostingSchedule = typeof postingSchedule.$inferSelect;

// Remarketing vehicles - Master user selects up to 20 vehicles for remarketing campaigns
export const remarketingVehicles = pgTable("remarketing_vehicles", {
  id: serial("id").primaryKey(),
  dealershipId: integer("dealership_id").notNull().references(() => dealerships.id, { onDelete: 'cascade' }),
  vehicleId: integer("vehicle_id").notNull().references(() => vehicles.id, { onDelete: 'cascade' }),
  budgetPriority: integer("budget_priority").notNull(), // 1-5 scale (5 = highest priority)
  isActive: boolean("is_active").notNull().default(true),
  addedAt: timestamp("added_at").defaultNow().notNull(),
});

export const insertRemarketingVehicleSchema = createInsertSchema(remarketingVehicles).omit({
  id: true,
  addedAt: true,
});

export type InsertRemarketingVehicle = z.infer<typeof insertRemarketingVehicleSchema>;
export type RemarketingVehicle = typeof remarketingVehicles.$inferSelect;

// PBS DMS Integration Configuration
export const pbsConfig = pgTable("pbs_config", {
  id: serial("id").primaryKey(),
  dealershipId: integer("dealership_id").notNull().references(() => dealerships.id, { onDelete: 'cascade' }),
  partnerId: text("partner_id").notNull(), // PBS Partner ID
  username: text("username").notNull(), // PBS API username
  password: text("password").notNull(), // PBS API password (encrypted)
  webhookUrl: text("webhook_url"), // Our endpoint URL for PBS to send webhooks
  webhookSecret: text("webhook_secret"), // Secret for webhook signature verification
  pbsApiUrl: text("pbs_api_url").notNull().default('https://partnerhub.pbsdealers.com'), // PBS API endpoint
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertPbsConfigSchema = createInsertSchema(pbsConfig).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertPbsConfig = z.infer<typeof insertPbsConfigSchema>;
export type PbsConfig = typeof pbsConfig.$inferSelect;

// PBS Webhook Events Log
export const pbsWebhookEvents = pgTable("pbs_webhook_events", {
  id: serial("id").primaryKey(),
  dealershipId: integer("dealership_id").notNull().references(() => dealerships.id, { onDelete: 'cascade' }),
  eventType: text("event_type").notNull(), // e.g., 'customer.created', 'vehicle.updated', 'appointment.scheduled'
  eventId: text("event_id").notNull(), // PBS event ID
  payload: text("payload").notNull(), // JSON payload from PBS
  status: text("status").notNull().default('pending'), // pending, processed, failed
  errorMessage: text("error_message"), // If processing failed
  processedAt: timestamp("processed_at"),
  receivedAt: timestamp("received_at").defaultNow().notNull(),
});

export const insertPbsWebhookEventSchema = createInsertSchema(pbsWebhookEvents).omit({
  id: true,
  receivedAt: true,
});

export type InsertPbsWebhookEvent = z.infer<typeof insertPbsWebhookEventSchema>;
export type PbsWebhookEvent = typeof pbsWebhookEvents.$inferSelect;

// Manager Settings for postal code and search preferences
export const managerSettings = pgTable("manager_settings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  postalCode: text("postal_code").notNull(), // Canadian postal code (e.g., V6B 1A1)
  defaultRadiusKm: integer("default_radius_km").notNull().default(50), // Default search radius in kilometers
  geocodeLat: text("geocode_lat"), // Cached latitude from postal code
  geocodeLon: text("geocode_lon"), // Cached longitude from postal code
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertManagerSettingsSchema = createInsertSchema(managerSettings).omit({
  id: true,
  updatedAt: true,
});

export type InsertManagerSettings = z.infer<typeof insertManagerSettingsSchema>;
export type ManagerSettings = typeof managerSettings.$inferSelect;

// Market Listings Cache (scraped from AutoTrader, Kijiji, etc.)
export const marketListings = pgTable("market_listings", {
  id: serial("id").primaryKey(),
  dealershipId: integer("dealership_id").notNull().references(() => dealerships.id, { onDelete: 'cascade' }),
  externalId: text("external_id").notNull(), // Unique ID from source platform
  source: text("source").notNull(), // 'marketcheck', 'apify', 'autotrader_scraper'
  listingType: text("listing_type").notNull(), // 'dealer', 'private'
  year: integer("year").notNull(),
  make: text("make").notNull(),
  model: text("model").notNull(),
  trim: text("trim"),
  price: integer("price").notNull(),
  mileage: integer("mileage"), // in kilometers
  location: text("location").notNull(), // City, Province
  postalCode: text("postal_code"), // Seller postal code (if available)
  latitude: text("latitude"),
  longitude: text("longitude"),
  sellerName: text("seller_name"), // Dealer name or "Private Seller"
  imageUrl: text("image_url"),
  listingUrl: text("listing_url").notNull().unique(), // Original listing URL
  postedDate: timestamp("posted_date"), // When the listing was posted
  scrapedAt: timestamp("scraped_at").defaultNow().notNull(), // When we scraped it
  isActive: boolean("is_active").notNull().default(true), // False if listing is removed
});

export const insertMarketListingSchema = createInsertSchema(marketListings).omit({
  id: true,
  scrapedAt: true,
});

export type InsertMarketListing = z.infer<typeof insertMarketListingSchema>;
export type MarketListing = typeof marketListings.$inferSelect;
