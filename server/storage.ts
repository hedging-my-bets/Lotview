import { db } from "./db";
import { 
  dealerships,
  dealershipSubscriptions,
  dealershipApiKeys,
  vehicles, 
  vehicleViews, 
  facebookPages,
  pagePriorityVehicles,
  ghlConfig,
  ghlWebhookConfig,
  aiPromptTemplates,
  chatConversations,
  chatPrompts,
  adminConfig,
  users,
  creditScoreTiers,
  modelYearTerms,
  facebookAccounts,
  adTemplates,
  postingQueue,
  postingSchedule,
  remarketingVehicles,
  type Dealership,
  type InsertDealership,
  type DealershipSubscription,
  type InsertDealershipSubscription,
  type DealershipApiKeys,
  type InsertDealershipApiKeys,
  type Vehicle, 
  type InsertVehicle,
  type VehicleView,
  type InsertVehicleView,
  type FacebookPage,
  type InsertFacebookPage,
  type PagePriorityVehicle,
  type InsertPagePriorityVehicle,
  type GhlConfig,
  type InsertGhlConfig,
  type GhlWebhookConfig,
  type InsertGhlWebhookConfig,
  type AiPromptTemplate,
  type InsertAiPromptTemplate,
  type ChatConversation,
  type InsertChatConversation,
  type ChatPrompt,
  type InsertChatPrompt,
  type AdminConfig,
  type InsertAdminConfig,
  type User,
  type InsertUser,
  type CreditScoreTier,
  type InsertCreditScoreTier,
  type ModelYearTerm,
  type InsertModelYearTerm,
  type FacebookAccount,
  type InsertFacebookAccount,
  type AdTemplate,
  type InsertAdTemplate,
  type PostingQueue,
  type InsertPostingQueue,
  type PostingSchedule,
  type InsertPostingSchedule,
  type RemarketingVehicle,
  type InsertRemarketingVehicle,
  pbsConfig,
  type PbsConfig,
  type InsertPbsConfig,
  pbsWebhookEvents,
  type PbsWebhookEvent,
  type InsertPbsWebhookEvent,
  managerSettings,
  type ManagerSettings,
  type InsertManagerSettings,
  marketListings,
  type MarketListing,
  type InsertMarketListing
} from "@shared/schema";
import { eq, desc, sql, and, gte, lte } from "drizzle-orm";

export interface IStorage {
  // ====== DEALERSHIP MANAGEMENT ======
  getDealership(id: number): Promise<Dealership | undefined>;
  getDealershipBySlug(slug: string): Promise<Dealership | undefined>;
  getDealershipBySubdomain(subdomain: string): Promise<Dealership | undefined>;
  getAllDealerships(): Promise<Dealership[]>;
  createDealership(dealership: InsertDealership): Promise<Dealership>;
  updateDealership(id: number, dealership: Partial<InsertDealership>): Promise<Dealership | undefined>;
  deleteDealership(id: number): Promise<boolean>;
  
  // Dealership API keys
  getDealershipApiKeys(dealershipId: number): Promise<DealershipApiKeys | undefined>;
  saveDealershipApiKeys(keys: InsertDealershipApiKeys): Promise<DealershipApiKeys>;
  updateDealershipApiKeys(dealershipId: number, keys: Partial<InsertDealershipApiKeys>): Promise<DealershipApiKeys | undefined>;
  
  // Dealership subscriptions
  getDealershipSubscription(dealershipId: number): Promise<DealershipSubscription | undefined>;
  createDealershipSubscription(subscription: InsertDealershipSubscription): Promise<DealershipSubscription>;
  updateDealershipSubscription(dealershipId: number, subscription: Partial<InsertDealershipSubscription>): Promise<DealershipSubscription | undefined>;
  
  // ====== VEHICLE OPERATIONS (Multi-Tenant) ======
  // dealershipId is REQUIRED for all multi-tenant operations to ensure data isolation
  getVehicles(dealershipId: number): Promise<Vehicle[]>;
  getVehicleById(id: number, dealershipId: number): Promise<Vehicle | undefined>;
  createVehicle(vehicle: InsertVehicle): Promise<Vehicle>;
  updateVehicle(id: number, vehicle: Partial<InsertVehicle>, dealershipId: number): Promise<Vehicle | undefined>;
  deleteVehicle(id: number, dealershipId: number): Promise<boolean>;
  
  // View tracking (Multi-Tenant)
  trackVehicleView(view: InsertVehicleView): Promise<VehicleView>; // Must include dealershipId
  getVehicleViews(vehicleId: number, dealershipId: number, hours?: number): Promise<number>; // REQUIRED filtering
  getAllVehicleViews(dealershipId: number, hours?: number): Promise<Map<number, number>>; // REQUIRED filtering
  
  // Facebook pages
  getFacebookPages(): Promise<FacebookPage[]>;
  createFacebookPage(page: InsertFacebookPage): Promise<FacebookPage>;
  updateFacebookPage(id: number, page: Partial<InsertFacebookPage>): Promise<FacebookPage | undefined>;
  
  // Priority vehicles
  getPagePriorityVehicles(pageId: number): Promise<PagePriorityVehicle[]>;
  setPagePriorityVehicles(pageId: number, vehicleIds: number[]): Promise<void>;
  
  // GoHighLevel config
  saveGHLConfig(config: InsertGhlConfig): Promise<GhlConfig>;
  
  // GHL Webhook config
  saveGHLWebhookConfig(config: InsertGhlWebhookConfig): Promise<GhlWebhookConfig>;
  getActiveGHLWebhookConfig(): Promise<GhlWebhookConfig | undefined>;
  
  // AI prompt templates
  saveAIPromptTemplate(template: InsertAiPromptTemplate): Promise<AiPromptTemplate>;
  
  // Chat conversations (Multi-Tenant)
  saveChatConversation(conversation: InsertChatConversation): Promise<ChatConversation>; // Must include dealershipId
  getAllConversations(dealershipId: number, category?: string): Promise<ChatConversation[]>; // REQUIRED filtering
  getConversationById(id: number, dealershipId: number): Promise<ChatConversation | undefined>; // REQUIRED filtering
  updateConversationHandoff(id: number, dealershipId: number, data: { handoffRequested?: boolean; handoffPhone?: string; handoffSent?: boolean; handoffSentAt?: Date }): Promise<ChatConversation | undefined>;
  
  // Chat prompts
  getChatPrompts(): Promise<ChatPrompt[]>;
  getChatPromptByScenario(scenario: string): Promise<ChatPrompt | undefined>;
  saveChatPrompt(prompt: InsertChatPrompt): Promise<ChatPrompt>;
  updateChatPrompt(scenario: string, prompt: Partial<InsertChatPrompt>): Promise<ChatPrompt | undefined>;
  
  // Admin
  getAdminConfig(): Promise<AdminConfig | undefined>;
  setAdminPassword(passwordHash: string): Promise<AdminConfig>;
  
  // User management (Multi-Tenant)
  getUserByEmail(email: string, dealershipId?: number): Promise<User | undefined>; // dealershipId optional for auth lookup
  getUserById(id: number, dealershipId?: number): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>; // Must include dealershipId in user data
  updateUser(id: number, user: Partial<InsertUser>, dealershipId?: number): Promise<User | undefined>;
  getAllUsers(dealershipId: number): Promise<User[]>; // REQUIRED: only get users from specific dealership
  getUsersByRole(role: string): Promise<User[]>;
  
  // Financing rules - Credit score tiers
  getCreditScoreTiers(): Promise<CreditScoreTier[]>;
  createCreditScoreTier(tier: InsertCreditScoreTier): Promise<CreditScoreTier>;
  updateCreditScoreTier(id: number, tier: Partial<InsertCreditScoreTier>): Promise<CreditScoreTier | undefined>;
  deleteCreditScoreTier(id: number): Promise<boolean>;
  getInterestRateForCreditScore(score: number): Promise<number | null>;
  
  // Financing rules - Model year terms
  getModelYearTerms(): Promise<ModelYearTerm[]>;
  createModelYearTerm(term: InsertModelYearTerm): Promise<ModelYearTerm>;
  updateModelYearTerm(id: number, term: Partial<InsertModelYearTerm>): Promise<ModelYearTerm | undefined>;
  deleteModelYearTerm(id: number): Promise<boolean>;
  getAvailableTermsForYear(modelYear: number): Promise<string[]>;
  
  // Facebook Accounts
  getFacebookAccountsByUser(userId: number): Promise<FacebookAccount[]>;
  getFacebookAccountById(id: number, userId: number): Promise<FacebookAccount | undefined>;
  createFacebookAccount(account: InsertFacebookAccount): Promise<FacebookAccount>;
  updateFacebookAccount(id: number, userId: number, account: Partial<InsertFacebookAccount>): Promise<FacebookAccount | undefined>;
  deleteFacebookAccount(id: number, userId: number): Promise<boolean>;
  
  // Ad Templates
  getAdTemplatesByUser(userId: number): Promise<AdTemplate[]>;
  getAdTemplateById(id: number, userId: number): Promise<AdTemplate | undefined>;
  createAdTemplate(template: InsertAdTemplate): Promise<AdTemplate>;
  updateAdTemplate(id: number, userId: number, template: Partial<InsertAdTemplate>): Promise<AdTemplate | undefined>;
  deleteAdTemplate(id: number, userId: number): Promise<boolean>;
  
  // Posting Queue
  getPostingQueueByUser(userId: number): Promise<PostingQueue[]>;
  getPostingQueueItem(id: number): Promise<PostingQueue | undefined>;
  createPostingQueueItem(item: InsertPostingQueue): Promise<PostingQueue>;
  updatePostingQueueItem(id: number, userId: number, item: Partial<InsertPostingQueue>): Promise<PostingQueue | undefined>;
  deletePostingQueueItem(id: number, userId: number): Promise<boolean>;
  getNextQueuedPost(userId: number): Promise<PostingQueue | undefined>;
  
  // Posting Schedule
  getPostingScheduleByUser(userId: number): Promise<PostingSchedule | undefined>;
  getAllPostingSchedules(): Promise<PostingSchedule[]>;
  createPostingSchedule(schedule: InsertPostingSchedule): Promise<PostingSchedule>;
  updatePostingSchedule(userId: number, schedule: Partial<InsertPostingSchedule>): Promise<PostingSchedule | undefined>;
  
  // Remarketing Vehicles (Multi-Tenant)
  getRemarketingVehicles(dealershipId: number): Promise<RemarketingVehicle[]>; // REQUIRED filtering
  addRemarketingVehicle(vehicle: InsertRemarketingVehicle): Promise<RemarketingVehicle>; // Must include dealershipId
  updateRemarketingVehicle(id: number, dealershipId: number, vehicle: Partial<InsertRemarketingVehicle>): Promise<RemarketingVehicle | undefined>;
  removeRemarketingVehicle(id: number, dealershipId: number): Promise<boolean>;
  getRemarketingVehicleCount(dealershipId: number): Promise<number>; // REQUIRED filtering
  
  // PBS DMS Integration
  getPbsConfig(): Promise<PbsConfig | undefined>;
  createPbsConfig(config: InsertPbsConfig): Promise<PbsConfig>;
  updatePbsConfig(id: number, config: Partial<InsertPbsConfig>): Promise<PbsConfig | undefined>;
  deletePbsConfig(id: number): Promise<boolean>;
  
  // PBS Webhook Events
  getPbsWebhookEvents(limit?: number): Promise<PbsWebhookEvent[]>;
  getPbsWebhookEventById(id: number): Promise<PbsWebhookEvent | undefined>;
  createPbsWebhookEvent(event: InsertPbsWebhookEvent): Promise<PbsWebhookEvent>;
  updatePbsWebhookEvent(id: number, event: Partial<InsertPbsWebhookEvent>): Promise<PbsWebhookEvent | undefined>;
  
  // Manager Settings
  getManagerSettings(userId: number): Promise<ManagerSettings | undefined>;
  createManagerSettings(settings: InsertManagerSettings): Promise<ManagerSettings>;
  updateManagerSettings(userId: number, settings: Partial<InsertManagerSettings>): Promise<ManagerSettings | undefined>;
  
  // Market Listings
  getMarketListings(filters: { make?: string; model?: string; yearMin?: number; yearMax?: number; source?: string }): Promise<MarketListing[]>;
  getMarketListingById(id: number): Promise<MarketListing | undefined>;
  getMarketListingsByUrls(urls: string[]): Promise<MarketListing[]>;
  createMarketListing(listing: InsertMarketListing): Promise<MarketListing>;
  updateMarketListing(id: number, listing: Partial<InsertMarketListing>): Promise<MarketListing | undefined>;
  deactivateMarketListing(url: string): Promise<boolean>;
  deleteOldMarketListings(daysOld: number): Promise<number>;
}

export class DatabaseStorage implements IStorage {
  // ====== DEALERSHIP MANAGEMENT ======
  async getDealership(id: number): Promise<Dealership | undefined> {
    const result = await db.select().from(dealerships).where(eq(dealerships.id, id)).limit(1);
    return result[0];
  }

  async getDealershipBySlug(slug: string): Promise<Dealership | undefined> {
    const result = await db.select().from(dealerships).where(eq(dealerships.slug, slug)).limit(1);
    return result[0];
  }

  async getDealershipBySubdomain(subdomain: string): Promise<Dealership | undefined> {
    const result = await db.select().from(dealerships).where(eq(dealerships.subdomain, subdomain)).limit(1);
    return result[0];
  }

  async getAllDealerships(): Promise<Dealership[]> {
    return await db.select().from(dealerships).orderBy(dealerships.name);
  }

  async createDealership(dealership: InsertDealership): Promise<Dealership> {
    const result = await db.insert(dealerships).values(dealership).returning();
    return result[0];
  }

  async updateDealership(id: number, dealership: Partial<InsertDealership>): Promise<Dealership | undefined> {
    const result = await db.update(dealerships).set({ ...dealership, updatedAt: new Date() }).where(eq(dealerships.id, id)).returning();
    return result[0];
  }

  async deleteDealership(id: number): Promise<boolean> {
    await db.delete(dealerships).where(eq(dealerships.id, id));
    return true;
  }

  // Dealership API keys
  async getDealershipApiKeys(dealershipId: number): Promise<DealershipApiKeys | undefined> {
    const result = await db.select().from(dealershipApiKeys).where(eq(dealershipApiKeys.dealershipId, dealershipId)).limit(1);
    return result[0];
  }

  async saveDealershipApiKeys(keys: InsertDealershipApiKeys): Promise<DealershipApiKeys> {
    // Check if keys already exist for this dealership
    const existing = await this.getDealershipApiKeys(keys.dealershipId);
    
    if (existing) {
      // Update existing keys
      const result = await db.update(dealershipApiKeys)
        .set({ ...keys, updatedAt: new Date() })
        .where(eq(dealershipApiKeys.dealershipId, keys.dealershipId))
        .returning();
      return result[0];
    } else {
      // Create new keys
      const result = await db.insert(dealershipApiKeys).values(keys).returning();
      return result[0];
    }
  }

  async updateDealershipApiKeys(dealershipId: number, keys: Partial<InsertDealershipApiKeys>): Promise<DealershipApiKeys | undefined> {
    const result = await db.update(dealershipApiKeys)
      .set({ ...keys, updatedAt: new Date() })
      .where(eq(dealershipApiKeys.dealershipId, dealershipId))
      .returning();
    return result[0];
  }

  // Dealership subscriptions
  async getDealershipSubscription(dealershipId: number): Promise<DealershipSubscription | undefined> {
    const result = await db.select().from(dealershipSubscriptions).where(eq(dealershipSubscriptions.dealershipId, dealershipId)).limit(1);
    return result[0];
  }

  async createDealershipSubscription(subscription: InsertDealershipSubscription): Promise<DealershipSubscription> {
    const result = await db.insert(dealershipSubscriptions).values(subscription).returning();
    return result[0];
  }

  async updateDealershipSubscription(dealershipId: number, subscription: Partial<InsertDealershipSubscription>): Promise<DealershipSubscription | undefined> {
    const result = await db.update(dealershipSubscriptions)
      .set({ ...subscription, updatedAt: new Date() })
      .where(eq(dealershipSubscriptions.dealershipId, dealershipId))
      .returning();
    return result[0];
  }

  // ====== VEHICLE OPERATIONS (Multi-Tenant) ======
  // All operations enforce dealership isolation for security
  async getVehicles(dealershipId: number): Promise<Vehicle[]> {
    return await db.select().from(vehicles)
      .where(eq(vehicles.dealershipId, dealershipId))
      .orderBy(desc(vehicles.createdAt));
  }

  async getVehicleById(id: number, dealershipId: number): Promise<Vehicle | undefined> {
    const result = await db.select().from(vehicles)
      .where(and(
        eq(vehicles.id, id), 
        eq(vehicles.dealershipId, dealershipId)
      ))
      .limit(1);
    return result[0];
  }

  async createVehicle(vehicle: InsertVehicle): Promise<Vehicle> {
    // Ensure dealershipId is set - it's required in schema
    if (!vehicle.dealershipId) {
      throw new Error('dealershipId is required when creating a vehicle');
    }
    const result = await db.insert(vehicles).values(vehicle).returning();
    return result[0];
  }

  async updateVehicle(id: number, vehicle: Partial<InsertVehicle>, dealershipId: number): Promise<Vehicle | undefined> {
    // Only update vehicles belonging to this dealership
    const result = await db.update(vehicles)
      .set(vehicle)
      .where(and(
        eq(vehicles.id, id),
        eq(vehicles.dealershipId, dealershipId)
      ))
      .returning();
    return result[0];
  }

  async deleteVehicle(id: number, dealershipId: number): Promise<boolean> {
    // Only delete vehicles belonging to this dealership
    await db.delete(vehicles).where(and(
      eq(vehicles.id, id),
      eq(vehicles.dealershipId, dealershipId)
    ));
    return true;
  }

  // ====== VIEW TRACKING (Multi-Tenant - CRITICAL for analytics security) ======
  async trackVehicleView(view: InsertVehicleView): Promise<VehicleView> {
    // Validate dealershipId is present before insert
    if (!view.dealershipId) {
      throw new Error('dealershipId is required when tracking vehicle views');
    }
    const result = await db.insert(vehicleViews).values(view).returning();
    return result[0];
  }

  async getVehicleViews(vehicleId: number, dealershipId: number, hours: number = 24): Promise<number> {
    // CRITICAL: Join with vehicles table to enforce dealership isolation
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(vehicleViews)
      .innerJoin(vehicles, eq(vehicleViews.vehicleId, vehicles.id))
      .where(
        and(
          eq(vehicleViews.vehicleId, vehicleId),
          eq(vehicles.dealershipId, dealershipId), // ENFORCE dealership filtering
          sql`${vehicleViews.viewedAt} >= ${cutoffTime}`
        )
      );
    return Number(result[0]?.count || 0);
  }
  
  async getAllVehicleViews(dealershipId: number, hours: number = 24): Promise<Map<number, number>> {
    // CRITICAL: Only return views for vehicles belonging to this dealership
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    const result = await db
      .select({
        vehicleId: vehicleViews.vehicleId,
        count: sql<number>`count(*)`
      })
      .from(vehicleViews)
      .innerJoin(vehicles, eq(vehicleViews.vehicleId, vehicles.id))
      .where(and(
        eq(vehicles.dealershipId, dealershipId), // ENFORCE dealership filtering
        sql`${vehicleViews.viewedAt} >= ${cutoffTime}`
      ))
      .groupBy(vehicleViews.vehicleId);
    
    const viewsMap = new Map<number, number>();
    result.forEach(row => {
      viewsMap.set(row.vehicleId, Number(row.count));
    });
    return viewsMap;
  }

  // Facebook pages
  async getFacebookPages(): Promise<FacebookPage[]> {
    return await db.select().from(facebookPages).where(eq(facebookPages.isActive, true));
  }

  async createFacebookPage(page: InsertFacebookPage): Promise<FacebookPage> {
    const result = await db.insert(facebookPages).values(page).returning();
    return result[0];
  }

  async updateFacebookPage(id: number, page: Partial<InsertFacebookPage>): Promise<FacebookPage | undefined> {
    const result = await db.update(facebookPages).set(page).where(eq(facebookPages.id, id)).returning();
    return result[0];
  }

  // Priority vehicles
  async getPagePriorityVehicles(pageId: number): Promise<PagePriorityVehicle[]> {
    return await db.select().from(pagePriorityVehicles).where(eq(pagePriorityVehicles.pageId, pageId));
  }

  async setPagePriorityVehicles(pageId: number, vehicleIds: number[]): Promise<void> {
    // Delete existing priorities
    await db.delete(pagePriorityVehicles).where(eq(pagePriorityVehicles.pageId, pageId));
    
    // Insert new priorities
    if (vehicleIds.length > 0) {
      await db.insert(pagePriorityVehicles).values(
        vehicleIds.map((vehicleId, index) => ({
          pageId,
          vehicleId,
          priority: index + 1
        }))
      );
    }
  }

  // GoHighLevel config
  async saveGHLConfig(config: InsertGhlConfig): Promise<GhlConfig> {
    // Deactivate all existing configs
    await db.update(ghlConfig).set({ isActive: false });
    
    // Insert new active config
    const result = await db.insert(ghlConfig).values(config).returning();
    return result[0];
  }

  // GHL Webhook config
  async saveGHLWebhookConfig(config: InsertGhlWebhookConfig): Promise<GhlWebhookConfig> {
    // Deactivate all existing webhook configs
    await db.update(ghlWebhookConfig).set({ isActive: false });
    
    // Insert new active config
    const result = await db.insert(ghlWebhookConfig).values(config).returning();
    return result[0];
  }

  async getActiveGHLWebhookConfig(): Promise<GhlWebhookConfig | undefined> {
    const result = await db.select().from(ghlWebhookConfig).where(eq(ghlWebhookConfig.isActive, true)).limit(1);
    return result[0];
  }

  // AI prompt templates
  async saveAIPromptTemplate(template: InsertAiPromptTemplate): Promise<AiPromptTemplate> {
    // Deactivate all existing templates if this one is active
    if (template.isActive) {
      await db.update(aiPromptTemplates).set({ isActive: false });
    }
    
    // Insert new template
    const result = await db.insert(aiPromptTemplates).values(template).returning();
    return result[0];
  }

  // ====== CHAT CONVERSATIONS (Multi-Tenant) ======
  async saveChatConversation(conversation: InsertChatConversation): Promise<ChatConversation> {
    // Validate dealershipId is present before insert
    if (!conversation.dealershipId) {
      throw new Error('dealershipId is required when creating a chat conversation');
    }
    const result = await db.insert(chatConversations).values(conversation).returning();
    return result[0];
  }

  async getAllConversations(dealershipId: number, category?: string): Promise<ChatConversation[]> {
    // REQUIRED: Only return conversations from specific dealership
    const conditions = category
      ? and(eq(chatConversations.dealershipId, dealershipId), eq(chatConversations.category, category))
      : eq(chatConversations.dealershipId, dealershipId);
    
    return await db.select().from(chatConversations)
      .where(conditions)
      .orderBy(desc(chatConversations.createdAt));
  }

  async getConversationById(id: number, dealershipId: number): Promise<ChatConversation | undefined> {
    // REQUIRED: Filter by dealership to prevent cross-tenant access
    const result = await db.select().from(chatConversations)
      .where(and(
        eq(chatConversations.id, id),
        eq(chatConversations.dealershipId, dealershipId)
      ))
      .limit(1);
    return result[0];
  }

  async updateConversationHandoff(id: number, dealershipId: number, data: { handoffRequested?: boolean; handoffPhone?: string; handoffSent?: boolean; handoffSentAt?: Date }): Promise<ChatConversation | undefined> {
    // REQUIRED: Only update conversations from this dealership
    const result = await db.update(chatConversations)
      .set(data)
      .where(and(
        eq(chatConversations.id, id),
        eq(chatConversations.dealershipId, dealershipId)
      ))
      .returning();
    return result[0];
  }

  // Chat prompts
  async getChatPrompts(): Promise<ChatPrompt[]> {
    return await db.select().from(chatPrompts).where(eq(chatPrompts.isActive, true));
  }

  async getChatPromptByScenario(scenario: string): Promise<ChatPrompt | undefined> {
    const result = await db.select().from(chatPrompts).where(eq(chatPrompts.scenario, scenario)).limit(1);
    return result[0];
  }

  async saveChatPrompt(prompt: InsertChatPrompt): Promise<ChatPrompt> {
    const result = await db.insert(chatPrompts).values(prompt).returning();
    return result[0];
  }

  async updateChatPrompt(scenario: string, prompt: Partial<InsertChatPrompt>): Promise<ChatPrompt | undefined> {
    const result = await db.update(chatPrompts).set(prompt).where(eq(chatPrompts.scenario, scenario)).returning();
    return result[0];
  }

  // Admin
  async getAdminConfig(): Promise<AdminConfig | undefined> {
    const result = await db.select().from(adminConfig).limit(1);
    return result[0];
  }

  async setAdminPassword(passwordHash: string): Promise<AdminConfig> {
    // Delete any existing config
    await db.delete(adminConfig);
    // Insert new config
    const result = await db.insert(adminConfig).values({ passwordHash }).returning();
    return result[0];
  }

  // ====== USER MANAGEMENT (Multi-Tenant) ======
  async getUserByEmail(email: string, dealershipId?: number): Promise<User | undefined> {
    // dealershipId is optional for authentication - we need to find user first, then check dealership
    // If dealershipId is provided, filter by it; otherwise allow login and check access separately
    const conditions = dealershipId 
      ? and(eq(users.email, email), eq(users.dealershipId, dealershipId))
      : eq(users.email, email);
    
    const result = await db.select().from(users).where(conditions).limit(1);
    return result[0];
  }

  async getUserById(id: number, dealershipId?: number): Promise<User | undefined> {
    // Allow looking up user by ID with optional dealership filtering
    // Master users (dealershipId = null) can access any user
    const conditions = dealershipId
      ? and(eq(users.id, id), eq(users.dealershipId, dealershipId))
      : eq(users.id, id);
    
    const result = await db.select().from(users).where(conditions).limit(1);
    return result[0];
  }

  async createUser(user: InsertUser): Promise<User> {
    // Ensure dealershipId is set for non-master users
    if (!user.dealershipId && user.role !== 'master') {
      throw new Error('dealershipId is required when creating a non-master user');
    }
    const result = await db.insert(users).values(user).returning();
    return result[0];
  }

  async updateUser(id: number, user: Partial<InsertUser>, dealershipId?: number): Promise<User | undefined> {
    // If dealershipId is provided, only update users from that dealership
    const conditions = dealershipId
      ? and(eq(users.id, id), eq(users.dealershipId, dealershipId))
      : eq(users.id, id);
    
    const result = await db.update(users).set(user).where(conditions).returning();
    return result[0];
  }

  async getAllUsers(dealershipId: number): Promise<User[]> {
    // REQUIRED: only return users from specific dealership
    return await db.select().from(users)
      .where(eq(users.dealershipId, dealershipId))
      .orderBy(desc(users.createdAt));
  }

  async getUsersByRole(role: string): Promise<User[]> {
    // TODO: Add dealershipId parameter to filter by dealership
    return await db.select().from(users).where(eq(users.role, role)).orderBy(desc(users.createdAt));
  }

  // Financing rules - Credit score tiers
  async getCreditScoreTiers(): Promise<CreditScoreTier[]> {
    return await db.select().from(creditScoreTiers).where(eq(creditScoreTiers.isActive, true)).orderBy(creditScoreTiers.minScore);
  }

  async createCreditScoreTier(tier: InsertCreditScoreTier): Promise<CreditScoreTier> {
    const result = await db.insert(creditScoreTiers).values(tier).returning();
    return result[0];
  }

  async updateCreditScoreTier(id: number, tier: Partial<InsertCreditScoreTier>): Promise<CreditScoreTier | undefined> {
    const result = await db.update(creditScoreTiers).set({ ...tier, updatedAt: new Date() }).where(eq(creditScoreTiers.id, id)).returning();
    return result[0];
  }

  async deleteCreditScoreTier(id: number): Promise<boolean> {
    await db.update(creditScoreTiers).set({ isActive: false }).where(eq(creditScoreTiers.id, id));
    return true;
  }

  async getInterestRateForCreditScore(score: number): Promise<number | null> {
    const result = await db
      .select()
      .from(creditScoreTiers)
      .where(
        and(
          eq(creditScoreTiers.isActive, true),
          lte(creditScoreTiers.minScore, score),
          gte(creditScoreTiers.maxScore, score)
        )
      )
      .limit(1);
    
    return result[0]?.interestRate ?? null;
  }

  // Financing rules - Model year terms
  async getModelYearTerms(): Promise<ModelYearTerm[]> {
    return await db.select().from(modelYearTerms).where(eq(modelYearTerms.isActive, true)).orderBy(modelYearTerms.minModelYear);
  }

  async createModelYearTerm(term: InsertModelYearTerm): Promise<ModelYearTerm> {
    const result = await db.insert(modelYearTerms).values(term).returning();
    return result[0];
  }

  async updateModelYearTerm(id: number, term: Partial<InsertModelYearTerm>): Promise<ModelYearTerm | undefined> {
    const result = await db.update(modelYearTerms).set({ ...term, updatedAt: new Date() }).where(eq(modelYearTerms.id, id)).returning();
    return result[0];
  }

  async deleteModelYearTerm(id: number): Promise<boolean> {
    await db.update(modelYearTerms).set({ isActive: false }).where(eq(modelYearTerms.id, id));
    return true;
  }

  async getAvailableTermsForYear(modelYear: number): Promise<string[]> {
    const result = await db
      .select()
      .from(modelYearTerms)
      .where(
        and(
          eq(modelYearTerms.isActive, true),
          lte(modelYearTerms.minModelYear, modelYear),
          gte(modelYearTerms.maxModelYear, modelYear)
        )
      )
      .limit(1);
    
    return result[0]?.availableTerms ?? ["36", "48", "60"]; // Default terms if no rule found
  }

  // Facebook Accounts
  async getFacebookAccountsByUser(userId: number): Promise<FacebookAccount[]> {
    return await db.select().from(facebookAccounts).where(eq(facebookAccounts.userId, userId));
  }

  async getFacebookAccountById(id: number, userId: number): Promise<FacebookAccount | undefined> {
    const result = await db.select().from(facebookAccounts).where(
      and(eq(facebookAccounts.id, id), eq(facebookAccounts.userId, userId))
    ).limit(1);
    return result[0];
  }

  async createFacebookAccount(account: InsertFacebookAccount): Promise<FacebookAccount> {
    const result = await db.insert(facebookAccounts).values(account).returning();
    return result[0];
  }

  async updateFacebookAccount(id: number, userId: number, account: Partial<InsertFacebookAccount>): Promise<FacebookAccount | undefined> {
    const result = await db.update(facebookAccounts).set({ ...account, updatedAt: new Date() }).where(and(eq(facebookAccounts.id, id), eq(facebookAccounts.userId, userId))).returning();
    return result[0];
  }

  async deleteFacebookAccount(id: number, userId: number): Promise<boolean> {
    const result = await db.delete(facebookAccounts).where(and(eq(facebookAccounts.id, id), eq(facebookAccounts.userId, userId))).returning();
    return result.length > 0;
  }

  // Ad Templates
  async getAdTemplatesByUser(userId: number): Promise<AdTemplate[]> {
    return await db.select().from(adTemplates).where(eq(adTemplates.userId, userId));
  }

  async getAdTemplateById(id: number, userId: number): Promise<AdTemplate | undefined> {
    const result = await db.select().from(adTemplates).where(
      and(eq(adTemplates.id, id), eq(adTemplates.userId, userId))
    ).limit(1);
    return result[0];
  }

  async createAdTemplate(template: InsertAdTemplate): Promise<AdTemplate> {
    const result = await db.insert(adTemplates).values(template).returning();
    return result[0];
  }

  async updateAdTemplate(id: number, userId: number, template: Partial<InsertAdTemplate>): Promise<AdTemplate | undefined> {
    const result = await db.update(adTemplates).set({ ...template, updatedAt: new Date() }).where(and(eq(adTemplates.id, id), eq(adTemplates.userId, userId))).returning();
    return result[0];
  }

  async deleteAdTemplate(id: number, userId: number): Promise<boolean> {
    const result = await db.delete(adTemplates).where(and(eq(adTemplates.id, id), eq(adTemplates.userId, userId))).returning();
    return result.length > 0;
  }

  // Posting Queue
  async getPostingQueueByUser(userId: number): Promise<PostingQueue[]> {
    return await db.select().from(postingQueue).where(eq(postingQueue.userId, userId)).orderBy(postingQueue.queueOrder);
  }

  async getPostingQueueItem(id: number): Promise<PostingQueue | undefined> {
    const result = await db.select().from(postingQueue).where(eq(postingQueue.id, id)).limit(1);
    return result[0];
  }

  async createPostingQueueItem(item: InsertPostingQueue): Promise<PostingQueue> {
    const result = await db.insert(postingQueue).values(item).returning();
    return result[0];
  }

  async updatePostingQueueItem(id: number, userId: number, item: Partial<InsertPostingQueue>): Promise<PostingQueue | undefined> {
    const result = await db.update(postingQueue).set({ ...item, updatedAt: new Date() }).where(and(eq(postingQueue.id, id), eq(postingQueue.userId, userId))).returning();
    return result[0];
  }

  async deletePostingQueueItem(id: number, userId: number): Promise<boolean> {
    const result = await db.delete(postingQueue).where(and(eq(postingQueue.id, id), eq(postingQueue.userId, userId))).returning();
    return result.length > 0;
  }

  async getNextQueuedPost(userId: number): Promise<PostingQueue | undefined> {
    const result = await db
      .select()
      .from(postingQueue)
      .where(
        and(
          eq(postingQueue.userId, userId),
          eq(postingQueue.status, 'queued')
        )
      )
      .orderBy(postingQueue.queueOrder)
      .limit(1);
    
    return result[0];
  }

  // Posting Schedule
  async getPostingScheduleByUser(userId: number): Promise<PostingSchedule | undefined> {
    const result = await db.select().from(postingSchedule).where(eq(postingSchedule.userId, userId)).limit(1);
    return result[0];
  }

  async getAllPostingSchedules(): Promise<PostingSchedule[]> {
    return await db.select().from(postingSchedule);
  }

  async createPostingSchedule(schedule: InsertPostingSchedule): Promise<PostingSchedule> {
    const result = await db.insert(postingSchedule).values(schedule).returning();
    return result[0];
  }

  async updatePostingSchedule(userId: number, schedule: Partial<InsertPostingSchedule>): Promise<PostingSchedule | undefined> {
    const result = await db.update(postingSchedule).set({ ...schedule, updatedAt: new Date() }).where(eq(postingSchedule.userId, userId)).returning();
    return result[0];
  }

  // ====== REMARKETING VEHICLES (Multi-Tenant) ======
  async getRemarketingVehicles(dealershipId: number): Promise<RemarketingVehicle[]> {
    // REQUIRED: Only return remarketing vehicles from specific dealership
    return await db
      .select()
      .from(remarketingVehicles)
      .where(and(
        eq(remarketingVehicles.dealershipId, dealershipId),
        eq(remarketingVehicles.isActive, true)
      ))
      .orderBy(desc(remarketingVehicles.budgetPriority));
  }

  async addRemarketingVehicle(vehicle: InsertRemarketingVehicle): Promise<RemarketingVehicle> {
    // Validate dealershipId is present before insert
    if (!vehicle.dealershipId) {
      throw new Error('dealershipId is required when adding a remarketing vehicle');
    }
    const result = await db.insert(remarketingVehicles).values(vehicle).returning();
    return result[0];
  }

  async updateRemarketingVehicle(id: number, dealershipId: number, vehicle: Partial<InsertRemarketingVehicle>): Promise<RemarketingVehicle | undefined> {
    // REQUIRED: Only update remarketing vehicles from this dealership
    const result = await db
      .update(remarketingVehicles)
      .set(vehicle)
      .where(and(
        eq(remarketingVehicles.id, id),
        eq(remarketingVehicles.dealershipId, dealershipId)
      ))
      .returning();
    return result[0];
  }

  async removeRemarketingVehicle(id: number, dealershipId: number): Promise<boolean> {
    // REQUIRED: Soft delete only for this dealership
    const result = await db
      .update(remarketingVehicles)
      .set({ isActive: false })
      .where(and(
        eq(remarketingVehicles.id, id),
        eq(remarketingVehicles.dealershipId, dealershipId),
        eq(remarketingVehicles.isActive, true)
      ))
      .returning();
    return result.length > 0;
  }

  async getRemarketingVehicleCount(dealershipId: number): Promise<number> {
    // REQUIRED: Count only for specific dealership
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(remarketingVehicles)
      .where(and(
        eq(remarketingVehicles.dealershipId, dealershipId),
        eq(remarketingVehicles.isActive, true)
      ));
    return Number(result[0]?.count || 0);
  }

  // PBS DMS Integration
  async getPbsConfig(): Promise<PbsConfig | undefined> {
    const result = await db
      .select()
      .from(pbsConfig)
      .where(eq(pbsConfig.isActive, true))
      .limit(1);
    return result[0];
  }

  async createPbsConfig(config: InsertPbsConfig): Promise<PbsConfig> {
    const result = await db.insert(pbsConfig).values(config).returning();
    return result[0];
  }

  async updatePbsConfig(id: number, config: Partial<InsertPbsConfig>): Promise<PbsConfig | undefined> {
    const result = await db
      .update(pbsConfig)
      .set({ ...config, updatedAt: new Date() })
      .where(eq(pbsConfig.id, id))
      .returning();
    return result[0];
  }

  async deletePbsConfig(id: number): Promise<boolean> {
    const result = await db.delete(pbsConfig).where(eq(pbsConfig.id, id));
    return true;
  }

  // PBS Webhook Events
  async getPbsWebhookEvents(limit: number = 100): Promise<PbsWebhookEvent[]> {
    return await db
      .select()
      .from(pbsWebhookEvents)
      .orderBy(desc(pbsWebhookEvents.receivedAt))
      .limit(limit);
  }

  async getPbsWebhookEventById(id: number): Promise<PbsWebhookEvent | undefined> {
    const result = await db
      .select()
      .from(pbsWebhookEvents)
      .where(eq(pbsWebhookEvents.id, id))
      .limit(1);
    return result[0];
  }

  async createPbsWebhookEvent(event: InsertPbsWebhookEvent): Promise<PbsWebhookEvent> {
    const result = await db.insert(pbsWebhookEvents).values(event).returning();
    return result[0];
  }

  async updatePbsWebhookEvent(id: number, event: Partial<InsertPbsWebhookEvent>): Promise<PbsWebhookEvent | undefined> {
    const result = await db
      .update(pbsWebhookEvents)
      .set(event)
      .where(eq(pbsWebhookEvents.id, id))
      .returning();
    return result[0];
  }

  // Manager Settings
  async getManagerSettings(userId: number): Promise<ManagerSettings | undefined> {
    const result = await db
      .select()
      .from(managerSettings)
      .where(eq(managerSettings.userId, userId))
      .limit(1);
    return result[0];
  }

  async createManagerSettings(settings: InsertManagerSettings): Promise<ManagerSettings> {
    const result = await db.insert(managerSettings).values(settings).returning();
    return result[0];
  }

  async updateManagerSettings(userId: number, settings: Partial<InsertManagerSettings>): Promise<ManagerSettings | undefined> {
    const result = await db
      .update(managerSettings)
      .set({ ...settings, updatedAt: new Date() })
      .where(eq(managerSettings.userId, userId))
      .returning();
    return result[0];
  }

  // Market Listings
  async getMarketListings(filters: { make?: string; model?: string; yearMin?: number; yearMax?: number; source?: string }): Promise<MarketListing[]> {
    const conditions = [];
    
    // Always filter for active listings
    conditions.push(eq(marketListings.isActive, true));
    
    if (filters.make) {
      // Use parameterized case-insensitive comparison
      conditions.push(sql`LOWER(${marketListings.make}) = LOWER(${filters.make})`);
    }
    if (filters.model) {
      conditions.push(sql`LOWER(${marketListings.model}) = LOWER(${filters.model})`);
    }
    if (filters.yearMin) {
      conditions.push(gte(marketListings.year, filters.yearMin));
    }
    if (filters.yearMax) {
      conditions.push(lte(marketListings.year, filters.yearMax));
    }
    if (filters.source) {
      conditions.push(eq(marketListings.source, filters.source));
    }
    
    // Ensure we always have at least one condition
    const whereClause = conditions.length > 0 ? and(...conditions) : eq(marketListings.isActive, true);
    
    return await db
      .select()
      .from(marketListings)
      .where(whereClause)
      .orderBy(desc(marketListings.scrapedAt));
  }

  async getMarketListingById(id: number): Promise<MarketListing | undefined> {
    const result = await db
      .select()
      .from(marketListings)
      .where(eq(marketListings.id, id))
      .limit(1);
    return result[0];
  }

  async getMarketListingsByUrls(urls: string[]): Promise<MarketListing[]> {
    if (urls.length === 0) {
      return [];
    }
    
    const result = await db
      .select()
      .from(marketListings)
      .where(sql`${marketListings.listingUrl} = ANY(${urls})`);
    return result;
  }

  async createMarketListing(listing: InsertMarketListing): Promise<MarketListing> {
    const result = await db.insert(marketListings).values(listing).returning();
    return result[0];
  }

  async updateMarketListing(id: number, listing: Partial<InsertMarketListing>): Promise<MarketListing | undefined> {
    const result = await db
      .update(marketListings)
      .set(listing)
      .where(eq(marketListings.id, id))
      .returning();
    return result[0];
  }

  async deactivateMarketListing(url: string): Promise<boolean> {
    await db
      .update(marketListings)
      .set({ isActive: false })
      .where(eq(marketListings.listingUrl, url));
    return true;
  }

  async deleteOldMarketListings(daysOld: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    const result = await db
      .delete(marketListings)
      .where(lte(marketListings.scrapedAt, cutoffDate));
    
    return 0; // Drizzle doesn't return count for deletes
  }
}

export const storage = new DatabaseStorage();
