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
  address: text("address"), // Street address
  city: text("city"), // City
  province: text("province"), // Province/State (e.g., "BC")
  postalCode: text("postal_code"), // Postal/ZIP code
  phone: text("phone"), // Contact phone number
  timezone: text("timezone").default("America/Vancouver"), // Timezone for scheduling
  defaultCurrency: text("default_currency").default("CAD"), // Default currency code
  isActive: boolean("is_active").notNull().default(true),
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
  openaiApiKey: text("openai_api_key"), // OpenAI API key for per-dealership AI training
  marketcheckKey: text("marketcheck_key"), // MarketCheck API key
  apifyToken: text("apify_token"), // Apify API token
  apifyActorId: text("apify_actor_id"), // Apify actor ID for AutoTrader scraper
  geminiApiKey: text("gemini_api_key"), // Google Gemini Veo API key
  ghlApiKey: text("ghl_api_key"), // GoHighLevel API key
  ghlLocationId: text("ghl_location_id"), // GoHighLevel location/sub-account ID
  facebookAppId: text("facebook_app_id"), // Facebook App ID (shared or per-dealership)
  facebookAppSecret: text("facebook_app_secret"), // Facebook App Secret
  gtmContainerId: text("gtm_container_id"), // Google Tag Manager container ID (e.g., GTM-XXXXX)
  googleAnalyticsId: text("google_analytics_id"), // Google Analytics 4 measurement ID (e.g., G-XXXXX)
  googleAdsId: text("google_ads_id"), // Google Ads account ID for remarketing (e.g., AW-XXXXX)
  facebookPixelId: text("facebook_pixel_id"), // Facebook Pixel ID for remarketing
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

// External API tokens - For n8n and other external integrations
export const externalApiTokens = pgTable("external_api_tokens", {
  id: serial("id").primaryKey(),
  dealershipId: integer("dealership_id").notNull().references(() => dealerships.id, { onDelete: 'cascade' }),
  tokenName: text("token_name").notNull(), // Descriptive name (e.g., "n8n Scraper")
  tokenHash: text("token_hash").notNull(), // bcrypt hash of the token
  tokenPrefix: text("token_prefix").notNull(), // First 8 chars for identification (e.g., "oag_n8n_")
  permissions: text("permissions").array().notNull(), // ["import:vehicles", "read:vehicles"]
  lastUsedAt: timestamp("last_used_at"),
  expiresAt: timestamp("expires_at"), // Optional expiration
  isActive: boolean("is_active").notNull().default(true),
  createdBy: integer("created_by"), // User ID who created the token (no FK to avoid circular ref)
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertExternalApiTokenSchema = createInsertSchema(externalApiTokens).omit({
  id: true,
  createdAt: true,
});

export type InsertExternalApiToken = z.infer<typeof insertExternalApiTokenSchema>;
export type ExternalApiToken = typeof externalApiTokens.$inferSelect;

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
  carfaxUrl: text("carfax_url"), // Link to Carfax vehicle history report
  dealerVdpUrl: text("dealer_vdp_url"), // Link to dealer's vehicle detail page
  videoUrl: text("video_url"), // Generated video URL from Gemini Veo
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastScrapedAt: timestamp("last_scraped_at").defaultNow(), // Track when vehicle was last scraped (for incremental sync)
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
  role: text("role").notNull(), // 'super_admin', 'master', 'manager', 'salesperson'
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

// Global settings - Super admin manages API keys and global configuration
export const globalSettings = pgTable("global_settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(), // e.g., 'marketcheck_api_key', 'apify_api_key'
  value: text("value").notNull(), // Encrypted value
  description: text("description"), // Human-readable description
  isSecret: boolean("is_secret").notNull().default(true), // If true, mask value in UI
  updatedBy: integer("updated_by").references(() => users.id), // Super admin who last updated
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertGlobalSettingSchema = createInsertSchema(globalSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertGlobalSetting = z.infer<typeof insertGlobalSettingSchema>;
export type GlobalSetting = typeof globalSettings.$inferSelect;

// Audit logs - Track all super admin actions
export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id), // Super admin who performed action
  action: text("action").notNull(), // e.g., 'create_dealership', 'update_global_setting'
  resource: text("resource").notNull(), // e.g., 'dealership', 'global_setting'
  resourceId: text("resource_id"), // ID of affected resource
  details: text("details"), // JSON with additional context
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  createdAt: true,
});

export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;

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

// Dealership fees - fees added to payment calculation but not shown in price
export const dealershipFees = pgTable("dealership_fees", {
  id: serial("id").primaryKey(),
  dealershipId: integer("dealership_id").notNull().references(() => dealerships.id, { onDelete: 'cascade' }),
  feeName: text("fee_name").notNull(), // e.g., "Admin Fee", "Documentation Fee", "Tire Levy"
  feeAmount: integer("fee_amount").notNull(), // Stored in cents (e.g., 49900 = $499.00)
  isPercentage: boolean("is_percentage").notNull().default(false), // If true, feeAmount is percentage * 100 (e.g., 150 = 1.5%)
  includeInPayment: boolean("include_in_payment").notNull().default(true), // Include in payment calculation
  isActive: boolean("is_active").notNull().default(true),
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertDealershipFeeSchema = createInsertSchema(dealershipFees).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertDealershipFee = z.infer<typeof insertDealershipFeeSchema>;
export type DealershipFee = typeof dealershipFees.$inferSelect;

// Scrape sources - URLs to scrape for inventory
export const scrapeSources = pgTable("scrape_sources", {
  id: serial("id").primaryKey(),
  dealershipId: integer("dealership_id").notNull().references(() => dealerships.id, { onDelete: 'cascade' }),
  sourceName: text("source_name").notNull(), // e.g., "Olympic Hyundai Vancouver", "Boundary Hyundai"
  sourceUrl: text("source_url").notNull(), // The URL to scrape
  sourceType: text("source_type").notNull().default("dealer_website"), // "dealer_website", "cargurus", "autotrader", etc.
  isActive: boolean("is_active").notNull().default(true),
  lastScrapedAt: timestamp("last_scraped_at"),
  vehicleCount: integer("vehicle_count").default(0), // Number of vehicles from this source
  scrapeFrequency: text("scrape_frequency").notNull().default("daily"), // "hourly", "daily", "weekly"
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertScrapeSourceSchema = createInsertSchema(scrapeSources).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastScrapedAt: true,
  vehicleCount: true,
});

export type InsertScrapeSource = z.infer<typeof insertScrapeSourceSchema>;
export type ScrapeSource = typeof scrapeSources.$inferSelect;

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

// Facebook Catalog configuration (for Automotive Inventory Ads)
export const facebookCatalogConfig = pgTable("facebook_catalog_config", {
  id: serial("id").primaryKey(),
  dealershipId: integer("dealership_id").notNull().references(() => dealerships.id, { onDelete: 'cascade' }).unique(),
  catalogId: text("catalog_id").notNull(), // Facebook Catalog ID
  accessToken: text("access_token").notNull(), // System user access token for catalog
  catalogName: text("catalog_name"), // Display name of catalog
  isActive: boolean("is_active").notNull().default(true),
  lastSyncAt: timestamp("last_sync_at"), // When we last synced inventory
  lastSyncStatus: text("last_sync_status"), // 'success', 'partial', 'failed'
  lastSyncMessage: text("last_sync_message"), // Details about last sync
  vehiclesSynced: integer("vehicles_synced").default(0), // Count of vehicles in catalog
  autoSyncEnabled: boolean("auto_sync_enabled").notNull().default(true), // Enable daily auto-sync
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertFacebookCatalogConfigSchema = createInsertSchema(facebookCatalogConfig).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastSyncAt: true,
  lastSyncStatus: true,
  lastSyncMessage: true,
  vehiclesSynced: true,
});

export type InsertFacebookCatalogConfig = z.infer<typeof insertFacebookCatalogConfigSchema>;
export type FacebookCatalogConfig = typeof facebookCatalogConfig.$inferSelect;

// Facebook Messenger conversations (from Facebook pages connected by salespeople)
export const messengerConversations = pgTable("messenger_conversations", {
  id: serial("id").primaryKey(),
  dealershipId: integer("dealership_id").notNull().references(() => dealerships.id, { onDelete: 'cascade' }),
  facebookAccountId: integer("facebook_account_id").notNull().references(() => facebookAccounts.id, { onDelete: 'cascade' }),
  pageId: text("page_id").notNull(), // Facebook Page ID
  pageName: text("page_name").notNull(), // Facebook Page name for display
  conversationId: text("conversation_id").notNull().unique(), // Facebook conversation ID
  participantName: text("participant_name").notNull(), // Customer's name from Facebook
  participantId: text("participant_id").notNull(), // Customer's Facebook ID
  lastMessage: text("last_message"), // Preview of last message
  lastMessageAt: timestamp("last_message_at"), // When last message was sent
  unreadCount: integer("unread_count").notNull().default(0),
  status: text("status").notNull().default('active'), // 'active', 'archived', 'spam'
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertMessengerConversationSchema = createInsertSchema(messengerConversations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertMessengerConversation = z.infer<typeof insertMessengerConversationSchema>;
export type MessengerConversation = typeof messengerConversations.$inferSelect;

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

// Price History Tracking (for trend analysis)
export const priceHistory = pgTable("price_history", {
  id: serial("id").primaryKey(),
  dealershipId: integer("dealership_id").notNull().references(() => dealerships.id, { onDelete: 'cascade' }),
  marketListingId: integer("market_listing_id").references(() => marketListings.id, { onDelete: 'cascade' }),
  externalId: text("external_id").notNull(), // Link to original listing
  source: text("source").notNull(), // 'autotrader', 'kijiji', 'cargurus', etc.
  year: integer("year").notNull(),
  make: text("make").notNull(),
  model: text("model").notNull(),
  trim: text("trim"),
  price: integer("price").notNull(),
  mileage: integer("mileage"),
  location: text("location").notNull(),
  sellerName: text("seller_name"),
  recordedAt: timestamp("recorded_at").defaultNow().notNull(),
});

export const insertPriceHistorySchema = createInsertSchema(priceHistory).omit({
  id: true,
  recordedAt: true,
});

export type InsertPriceHistory = z.infer<typeof insertPriceHistorySchema>;
export type PriceHistory = typeof priceHistory.$inferSelect;

// Competitor Dealers (tracked nearby competitors)
export const competitorDealers = pgTable("competitor_dealers", {
  id: serial("id").primaryKey(),
  dealershipId: integer("dealership_id").notNull().references(() => dealerships.id, { onDelete: 'cascade' }),
  competitorName: text("competitor_name").notNull(),
  competitorUrl: text("competitor_url"),
  competitorAddress: text("competitor_address"),
  city: text("city"),
  province: text("province"),
  postalCode: text("postal_code"),
  distanceKm: integer("distance_km"), // Distance from home dealership
  totalListings: integer("total_listings").default(0),
  averagePrice: integer("average_price"),
  lastScrapedAt: timestamp("last_scraped_at"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertCompetitorDealerSchema = createInsertSchema(competitorDealers).omit({
  id: true,
  createdAt: true,
});

export type InsertCompetitorDealer = z.infer<typeof insertCompetitorDealerSchema>;
export type CompetitorDealer = typeof competitorDealers.$inferSelect;

// Market Analysis Snapshots (daily/weekly summaries)
export const marketSnapshots = pgTable("market_snapshots", {
  id: serial("id").primaryKey(),
  dealershipId: integer("dealership_id").notNull().references(() => dealerships.id, { onDelete: 'cascade' }),
  snapshotDate: timestamp("snapshot_date").notNull(),
  make: text("make").notNull(),
  model: text("model").notNull(),
  yearMin: integer("year_min"),
  yearMax: integer("year_max"),
  totalListings: integer("total_listings").notNull(),
  averagePrice: integer("average_price").notNull(),
  medianPrice: integer("median_price").notNull(),
  minPrice: integer("min_price").notNull(),
  maxPrice: integer("max_price").notNull(),
  p10Price: integer("p10_price"), // 10th percentile
  p25Price: integer("p25_price"), // 25th percentile
  p75Price: integer("p75_price"), // 75th percentile
  p90Price: integer("p90_price"), // 90th percentile
  averageMileage: integer("average_mileage"),
  averageDaysOnMarket: integer("average_days_on_market"),
  sources: text("sources").array(), // Which sources contributed
  searchRadiusKm: integer("search_radius_km"),
  searchPostalCode: text("search_postal_code"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertMarketSnapshotSchema = createInsertSchema(marketSnapshots).omit({
  id: true,
  createdAt: true,
});

export type InsertMarketSnapshot = z.infer<typeof insertMarketSnapshotSchema>;
export type MarketSnapshot = typeof marketSnapshots.$inferSelect;

// ====== ONBOARDING SYSTEM TABLES ======

// Dealership branding - logos, colors, content
export const dealershipBranding = pgTable("dealership_branding", {
  id: serial("id").primaryKey(),
  dealershipId: integer("dealership_id").notNull().references(() => dealerships.id, { onDelete: 'cascade' }).unique(),
  logoUrl: text("logo_url"), // Main logo URL
  faviconUrl: text("favicon_url"), // Favicon URL
  primaryColor: text("primary_color").default('#022d60'), // Primary brand color (hex)
  secondaryColor: text("secondary_color").default('#00aad2'), // Secondary brand color (hex)
  heroHeadline: text("hero_headline"), // Main headline for inventory page
  heroSubheadline: text("hero_subheadline"), // Subheadline
  heroImageUrl: text("hero_image_url"), // Hero background image URL
  tagline: text("tagline"), // Dealership tagline
  customCss: text("custom_css"), // Custom CSS overrides
  promoBannerText: text("promo_banner_text"), // Optional promo banner
  promoBannerActive: boolean("promo_banner_active").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertDealershipBrandingSchema = createInsertSchema(dealershipBranding).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertDealershipBranding = z.infer<typeof insertDealershipBrandingSchema>;
export type DealershipBranding = typeof dealershipBranding.$inferSelect;

// Dealership contact channels
export const dealershipContacts = pgTable("dealership_contacts", {
  id: serial("id").primaryKey(),
  dealershipId: integer("dealership_id").notNull().references(() => dealerships.id, { onDelete: 'cascade' }).unique(),
  supportEmail: text("support_email"), // Customer support email
  salesEmail: text("sales_email"), // Sales team email
  salesPhone: text("sales_phone"), // Sales hotline
  smsNumber: text("sms_number"), // SMS/text number
  websiteUrl: text("website_url"), // Main website
  privacyPolicyUrl: text("privacy_policy_url"), // Privacy policy link
  termsOfServiceUrl: text("terms_of_service_url"), // Terms of service link
  businessHours: text("business_hours"), // JSON with hours per day
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertDealershipContactsSchema = createInsertSchema(dealershipContacts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertDealershipContacts = z.infer<typeof insertDealershipContactsSchema>;
export type DealershipContacts = typeof dealershipContacts.$inferSelect;

// Staff invitations - pending user accounts
export const staffInvites = pgTable("staff_invites", {
  id: serial("id").primaryKey(),
  dealershipId: integer("dealership_id").notNull().references(() => dealerships.id, { onDelete: 'cascade' }),
  email: text("email").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull(), // 'master', 'manager', 'salesperson'
  inviteToken: text("invite_token").notNull().unique(), // Hashed token for signup link
  status: text("status").notNull().default('pending'), // 'pending', 'accepted', 'expired'
  invitedBy: integer("invited_by").references(() => users.id),
  expiresAt: timestamp("expires_at").notNull(),
  acceptedAt: timestamp("accepted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertStaffInviteSchema = createInsertSchema(staffInvites).omit({
  id: true,
  createdAt: true,
  acceptedAt: true,
});

export type InsertStaffInvite = z.infer<typeof insertStaffInviteSchema>;
export type StaffInvite = typeof staffInvites.$inferSelect;

// Onboarding runs - track each onboarding execution
export const onboardingRuns = pgTable("onboarding_runs", {
  id: serial("id").primaryKey(),
  dealershipId: integer("dealership_id").references(() => dealerships.id, { onDelete: 'cascade' }),
  status: text("status").notNull().default('pending'), // 'pending', 'in_progress', 'completed', 'failed', 'partial'
  initiatedBy: integer("initiated_by").notNull().references(() => users.id),
  inputData: text("input_data").notNull(), // JSON of all onboarding form data
  errorMessage: text("error_message"), // Overall error if failed
  completedSteps: integer("completed_steps").default(0),
  totalSteps: integer("total_steps").default(0),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertOnboardingRunSchema = createInsertSchema(onboardingRuns).omit({
  id: true,
  createdAt: true,
  startedAt: true,
  completedAt: true,
});

export type InsertOnboardingRun = z.infer<typeof insertOnboardingRunSchema>;
export type OnboardingRun = typeof onboardingRuns.$inferSelect;

// Onboarding run steps - detailed progress for each step
export const onboardingRunSteps = pgTable("onboarding_run_steps", {
  id: serial("id").primaryKey(),
  runId: integer("run_id").notNull().references(() => onboardingRuns.id, { onDelete: 'cascade' }),
  stepName: text("step_name").notNull(), // e.g., 'create_dealership', 'seed_financing', 'create_users'
  stepOrder: integer("step_order").notNull(),
  status: text("status").notNull().default('pending'), // 'pending', 'in_progress', 'completed', 'failed', 'skipped'
  details: text("details"), // JSON with step-specific results
  errorMessage: text("error_message"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
});

export const insertOnboardingRunStepSchema = createInsertSchema(onboardingRunSteps).omit({
  id: true,
  startedAt: true,
  completedAt: true,
});

export type InsertOnboardingRunStep = z.infer<typeof insertOnboardingRunStepSchema>;
export type OnboardingRunStep = typeof onboardingRunSteps.$inferSelect;

// Integration status tracking - monitor each integration's health
export const integrationStatus = pgTable("integration_status", {
  id: serial("id").primaryKey(),
  dealershipId: integer("dealership_id").notNull().references(() => dealerships.id, { onDelete: 'cascade' }),
  integrationName: text("integration_name").notNull(), // 'openai', 'facebook', 'marketcheck', etc.
  status: text("status").notNull().default('not_configured'), // 'not_configured', 'pending', 'active', 'error', 'expired'
  lastCheckedAt: timestamp("last_checked_at"),
  lastSuccessAt: timestamp("last_success_at"),
  errorMessage: text("error_message"),
  configDetails: text("config_details"), // JSON with non-sensitive config info
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertIntegrationStatusSchema = createInsertSchema(integrationStatus).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertIntegrationStatus = z.infer<typeof insertIntegrationStatusSchema>;
export type IntegrationStatus = typeof integrationStatus.$inferSelect;

// Launch checklist - tracks manual tasks needed before dealership goes live
export const launchChecklist = pgTable("launch_checklist", {
  id: serial("id").primaryKey(),
  dealershipId: integer("dealership_id").notNull().references(() => dealerships.id, { onDelete: 'cascade' }),
  category: text("category").notNull(), // 'accounts', 'legal', 'branding', 'integrations', 'staff', 'content'
  taskName: text("task_name").notNull(), // e.g., 'Create Facebook Business Page'
  taskDescription: text("task_description"), // Detailed instructions
  isRequired: boolean("is_required").notNull().default(true), // Required vs optional
  status: text("status").notNull().default('pending'), // 'pending', 'in_progress', 'completed', 'skipped'
  completedBy: integer("completed_by").references(() => users.id),
  completedAt: timestamp("completed_at"),
  dueDate: timestamp("due_date"), // Optional deadline
  sortOrder: integer("sort_order").notNull().default(0), // For ordering within category
  externalUrl: text("external_url"), // Link to external service (e.g., Stripe signup)
  notes: text("notes"), // User notes about the task
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertLaunchChecklistSchema = createInsertSchema(launchChecklist).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
});

export type InsertLaunchChecklist = z.infer<typeof insertLaunchChecklistSchema>;
export type LaunchChecklist = typeof launchChecklist.$inferSelect;
