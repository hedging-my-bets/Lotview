import { db } from "./db";
import { 
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
  type InsertPostingSchedule
} from "@shared/schema";
import { eq, desc, sql, and, gte, lte } from "drizzle-orm";

export interface IStorage {
  // Vehicle operations
  getVehicles(): Promise<Vehicle[]>;
  getVehicleById(id: number): Promise<Vehicle | undefined>;
  createVehicle(vehicle: InsertVehicle): Promise<Vehicle>;
  updateVehicle(id: number, vehicle: Partial<InsertVehicle>): Promise<Vehicle | undefined>;
  deleteVehicle(id: number): Promise<boolean>;
  
  // View tracking
  trackVehicleView(view: InsertVehicleView): Promise<VehicleView>;
  getVehicleViews(vehicleId: number, hours?: number): Promise<number>;
  getAllVehicleViews(hours?: number): Promise<Map<number, number>>;
  
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
  
  // Chat conversations
  saveChatConversation(conversation: InsertChatConversation): Promise<ChatConversation>;
  getAllConversations(category?: string): Promise<ChatConversation[]>;
  getConversationById(id: number): Promise<ChatConversation | undefined>;
  updateConversationHandoff(id: number, data: { handoffRequested?: boolean; handoffPhone?: string; handoffSent?: boolean; handoffSentAt?: Date }): Promise<ChatConversation | undefined>;
  
  // Chat prompts
  getChatPrompts(): Promise<ChatPrompt[]>;
  getChatPromptByScenario(scenario: string): Promise<ChatPrompt | undefined>;
  saveChatPrompt(prompt: InsertChatPrompt): Promise<ChatPrompt>;
  updateChatPrompt(scenario: string, prompt: Partial<InsertChatPrompt>): Promise<ChatPrompt | undefined>;
  
  // Admin
  getAdminConfig(): Promise<AdminConfig | undefined>;
  setAdminPassword(passwordHash: string): Promise<AdminConfig>;
  
  // User management
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserById(id: number): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, user: Partial<InsertUser>): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
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
}

export class DatabaseStorage implements IStorage {
  // Vehicle operations
  async getVehicles(): Promise<Vehicle[]> {
    return await db.select().from(vehicles).orderBy(desc(vehicles.createdAt));
  }

  async getVehicleById(id: number): Promise<Vehicle | undefined> {
    const result = await db.select().from(vehicles).where(eq(vehicles.id, id)).limit(1);
    return result[0];
  }

  async createVehicle(vehicle: InsertVehicle): Promise<Vehicle> {
    const result = await db.insert(vehicles).values(vehicle).returning();
    return result[0];
  }

  async updateVehicle(id: number, vehicle: Partial<InsertVehicle>): Promise<Vehicle | undefined> {
    const result = await db.update(vehicles).set(vehicle).where(eq(vehicles.id, id)).returning();
    return result[0];
  }

  async deleteVehicle(id: number): Promise<boolean> {
    const result = await db.delete(vehicles).where(eq(vehicles.id, id));
    return true;
  }

  // View tracking
  async trackVehicleView(view: InsertVehicleView): Promise<VehicleView> {
    const result = await db.insert(vehicleViews).values(view).returning();
    return result[0];
  }

  async getVehicleViews(vehicleId: number, hours: number = 24): Promise<number> {
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(vehicleViews)
      .where(
        and(
          eq(vehicleViews.vehicleId, vehicleId),
          sql`${vehicleViews.viewedAt} >= ${cutoffTime}`
        )
      );
    return Number(result[0]?.count || 0);
  }
  
  async getAllVehicleViews(hours: number = 24): Promise<Map<number, number>> {
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    const result = await db
      .select({
        vehicleId: vehicleViews.vehicleId,
        count: sql<number>`count(*)`
      })
      .from(vehicleViews)
      .where(sql`${vehicleViews.viewedAt} >= ${cutoffTime}`)
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

  // Chat conversations
  async saveChatConversation(conversation: InsertChatConversation): Promise<ChatConversation> {
    const result = await db.insert(chatConversations).values(conversation).returning();
    return result[0];
  }

  async getAllConversations(category?: string): Promise<ChatConversation[]> {
    if (category) {
      return await db.select().from(chatConversations).where(eq(chatConversations.category, category)).orderBy(desc(chatConversations.createdAt));
    }
    return await db.select().from(chatConversations).orderBy(desc(chatConversations.createdAt));
  }

  async getConversationById(id: number): Promise<ChatConversation | undefined> {
    const result = await db.select().from(chatConversations).where(eq(chatConversations.id, id)).limit(1);
    return result[0];
  }

  async updateConversationHandoff(id: number, data: { handoffRequested?: boolean; handoffPhone?: string; handoffSent?: boolean; handoffSentAt?: Date }): Promise<ChatConversation | undefined> {
    const result = await db.update(chatConversations).set(data).where(eq(chatConversations.id, id)).returning();
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

  // User management
  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return result[0];
  }

  async getUserById(id: number): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async createUser(user: InsertUser): Promise<User> {
    const result = await db.insert(users).values(user).returning();
    return result[0];
  }

  async updateUser(id: number, user: Partial<InsertUser>): Promise<User | undefined> {
    const result = await db.update(users).set(user).where(eq(users.id, id)).returning();
    return result[0];
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(desc(users.createdAt));
  }

  async getUsersByRole(role: string): Promise<User[]> {
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

  async getFacebookAccountById(id: number): Promise<FacebookAccount | undefined> {
    const result = await db.select().from(facebookAccounts).where(eq(facebookAccounts.id, id)).limit(1);
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

  async getAdTemplateById(id: number): Promise<AdTemplate | undefined> {
    const result = await db.select().from(adTemplates).where(eq(adTemplates.id, id)).limit(1);
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

  async createPostingSchedule(schedule: InsertPostingSchedule): Promise<PostingSchedule> {
    const result = await db.insert(postingSchedule).values(schedule).returning();
    return result[0];
  }

  async updatePostingSchedule(userId: number, schedule: Partial<InsertPostingSchedule>): Promise<PostingSchedule | undefined> {
    const result = await db.update(postingSchedule).set({ ...schedule, updatedAt: new Date() }).where(eq(postingSchedule.userId, userId)).returning();
    return result[0];
  }
}

export const storage = new DatabaseStorage();
