import { db } from "./db";
import { hashPassword } from "./auth";
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
  dealershipFees,
  scrapeSources,
  facebookAccounts,
  adTemplates,
  postingQueue,
  postingSchedule,
  messengerConversations,
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
  type DealershipFee,
  type InsertDealershipFee,
  type ScrapeSource,
  type InsertScrapeSource,
  type FacebookAccount,
  type InsertFacebookAccount,
  type AdTemplate,
  type InsertAdTemplate,
  type PostingQueue,
  type InsertPostingQueue,
  type PostingSchedule,
  type InsertPostingSchedule,
  type MessengerConversation,
  type InsertMessengerConversation,
  type RemarketingVehicle,
  type InsertRemarketingVehicle,
  pbsConfig,
  type PbsConfig,
  type InsertPbsConfig,
  pbsWebhookEvents,
  type PbsWebhookEvent,
  type InsertPbsWebhookEvent,
  pbsSessions,
  type PbsSession,
  type InsertPbsSession,
  pbsContactCache,
  type PbsContactCache,
  type InsertPbsContactCache,
  pbsAppointmentCache,
  type PbsAppointmentCache,
  type InsertPbsAppointmentCache,
  pbsPartsCache,
  type PbsPartsCache,
  type InsertPbsPartsCache,
  pbsApiLogs,
  type PbsApiLog,
  type InsertPbsApiLog,
  managerSettings,
  type ManagerSettings,
  type InsertManagerSettings,
  marketListings,
  type MarketListing,
  type InsertMarketListing,
  globalSettings,
  type GlobalSetting,
  type InsertGlobalSetting,
  auditLogs,
  type AuditLog,
  type InsertAuditLog,
  externalApiTokens,
  type ExternalApiToken,
  type InsertExternalApiToken,
  staffInvites,
  type StaffInvite,
  launchChecklist,
  type LaunchChecklist,
  type InsertLaunchChecklist,
  priceHistory,
  type PriceHistory,
  type InsertPriceHistory,
  competitorDealers,
  type CompetitorDealer,
  type InsertCompetitorDealer,
  marketSnapshots,
  type MarketSnapshot,
  type InsertMarketSnapshot,
  facebookCatalogConfig,
  type FacebookCatalogConfig,
  type InsertFacebookCatalogConfig,
  ghlAccounts,
  type GhlAccount,
  type InsertGhlAccount,
  ghlWebhookEvents,
  type GhlWebhookEvent,
  type InsertGhlWebhookEvent,
  ghlContactSync,
  type GhlContactSync,
  type InsertGhlContactSync,
  ghlAppointmentSync,
  type GhlAppointmentSync,
  type InsertGhlAppointmentSync,
  ghlApiLogs,
  type GhlApiLog,
  type InsertGhlApiLog
} from "@shared/schema";
import { eq, desc, sql, and, gte, lte, lt, gt, inArray, or, ilike } from "drizzle-orm";

export interface IStorage {
  // ====== SUPER ADMIN - GLOBAL SETTINGS ======
  getGlobalSetting(key: string): Promise<GlobalSetting | undefined>;
  getAllGlobalSettings(): Promise<GlobalSetting[]>;
  setGlobalSetting(setting: InsertGlobalSetting): Promise<GlobalSetting>;
  deleteGlobalSetting(key: string): Promise<boolean>;
  
  // ====== SUPER ADMIN - AUDIT LOGGING ======
  logAuditAction(log: InsertAuditLog): Promise<AuditLog>;
  getAuditLogs(limit?: number, offset?: number): Promise<{ logs: AuditLog[]; total: number }>;
  
  // ====== SUPER ADMIN - DEALERSHIP PROVISIONING ======
  createDealershipWithSetup(params: {
    name: string;
    slug: string;
    subdomain: string;
    address?: string;
    city?: string;
    province?: string;
    postalCode?: string;
    phone?: string;
    timezone?: string;
    defaultCurrency?: string;
    masterAdminEmail: string;
    masterAdminName: string;
    masterAdminPassword: string;
  }): Promise<{ dealership: Dealership; masterAdmin: User }>;
  
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
  getVehicles(dealershipId: number, limit?: number, offset?: number): Promise<{ vehicles: Vehicle[]; total: number }>;
  getVehicleById(id: number, dealershipId: number): Promise<Vehicle | undefined>;
  getVehicleByVin(vin: string, dealershipId: number): Promise<Vehicle | undefined>;
  deleteVehiclesByVinNotIn(vins: string[], dealershipId: number): Promise<{ deletedCount: number; deletedVins: string[] }>;
  createVehicle(vehicle: InsertVehicle): Promise<Vehicle>;
  updateVehicle(id: number, vehicle: Partial<InsertVehicle>, dealershipId: number): Promise<Vehicle | undefined>;
  deleteVehicle(id: number, dealershipId: number): Promise<boolean>;
  
  // View tracking (Multi-Tenant)
  trackVehicleView(view: InsertVehicleView): Promise<VehicleView>; // Must include dealershipId
  getVehicleViews(vehicleId: number, dealershipId: number, hours?: number): Promise<number>; // REQUIRED filtering
  getAllVehicleViews(dealershipId: number, hours?: number): Promise<Map<number, number>>; // REQUIRED filtering
  
  // Facebook pages
  getFacebookPages(dealershipId?: number): Promise<FacebookPage[]>;
  getFacebookPageByPageId(pageId: string): Promise<FacebookPage | undefined>;
  createFacebookPage(page: InsertFacebookPage): Promise<FacebookPage>;
  updateFacebookPage(id: number, page: Partial<InsertFacebookPage>): Promise<FacebookPage | undefined>;
  
  // Facebook Catalog Config (for Automotive Inventory Ads)
  getFacebookCatalogConfig(dealershipId: number): Promise<FacebookCatalogConfig | undefined>;
  getAllFacebookCatalogConfigs(): Promise<(FacebookCatalogConfig & { dealershipName?: string })[]>;
  saveFacebookCatalogConfig(config: InsertFacebookCatalogConfig): Promise<FacebookCatalogConfig>;
  updateFacebookCatalogConfig(dealershipId: number, config: Partial<InsertFacebookCatalogConfig>): Promise<FacebookCatalogConfig | undefined>;
  updateCatalogSyncStatus(dealershipId: number, status: { lastSyncAt?: Date; lastSyncStatus?: string; lastSyncMessage?: string; vehiclesSynced?: number }): Promise<FacebookCatalogConfig | undefined>;
  deleteFacebookCatalogConfig(dealershipId: number): Promise<boolean>;
  
  // Priority vehicles
  getPagePriorityVehicles(pageId: number): Promise<PagePriorityVehicle[]>;
  setPagePriorityVehicles(pageId: number, vehicleIds: number[]): Promise<void>;
  
  // GoHighLevel config
  saveGHLConfig(config: InsertGhlConfig): Promise<GhlConfig>;
  
  // GHL Webhook config
  saveGHLWebhookConfig(config: InsertGhlWebhookConfig): Promise<GhlWebhookConfig>;
  getActiveGHLWebhookConfig(dealershipId: number): Promise<GhlWebhookConfig | undefined>;
  
  // GHL Accounts (OAuth integration) - Multi-Tenant
  getGhlAccountByDealership(dealershipId: number): Promise<GhlAccount | undefined>;
  getGhlAccountById(id: number, dealershipId: number): Promise<GhlAccount | undefined>;
  createGhlAccount(account: InsertGhlAccount): Promise<GhlAccount>;
  updateGhlAccount(id: number, dealershipId: number, updates: Partial<InsertGhlAccount>): Promise<GhlAccount | undefined>;
  deleteGhlAccount(id: number, dealershipId: number): Promise<boolean>;
  
  // GHL Config (calendars, pipelines, mappings) - Multi-Tenant
  getGhlConfig(dealershipId: number): Promise<GhlConfig | undefined>;
  createGhlConfig(config: InsertGhlConfig): Promise<GhlConfig>;
  updateGhlConfig(id: number, dealershipId: number, updates: Partial<InsertGhlConfig>): Promise<GhlConfig | undefined>;
  
  // GHL Webhook Events - Multi-Tenant
  createGhlWebhookEvent(event: InsertGhlWebhookEvent): Promise<GhlWebhookEvent>;
  getGhlWebhookEvents(dealershipId: number, status?: string, limit?: number): Promise<GhlWebhookEvent[]>;
  updateGhlWebhookEvent(id: number, dealershipId: number, updates: Partial<InsertGhlWebhookEvent>): Promise<GhlWebhookEvent | undefined>;
  getGhlWebhookEventByEventId(dealershipId: number, eventId: string): Promise<GhlWebhookEvent | undefined>;
  
  // GHL Contact Sync - Multi-Tenant
  getGhlContactSync(dealershipId: number, ghlContactId: string): Promise<GhlContactSync | undefined>;
  getGhlContactSyncByPbsId(dealershipId: number, pbsContactId: string): Promise<GhlContactSync | undefined>;
  createGhlContactSync(sync: InsertGhlContactSync): Promise<GhlContactSync>;
  updateGhlContactSync(id: number, dealershipId: number, updates: Partial<InsertGhlContactSync>): Promise<GhlContactSync | undefined>;
  getPendingGhlContactSyncs(dealershipId: number, limit?: number): Promise<GhlContactSync[]>;
  
  // GHL Appointment Sync - Multi-Tenant
  getGhlAppointmentSync(dealershipId: number, ghlAppointmentId: string): Promise<GhlAppointmentSync | undefined>;
  createGhlAppointmentSync(sync: InsertGhlAppointmentSync): Promise<GhlAppointmentSync>;
  updateGhlAppointmentSync(id: number, dealershipId: number, updates: Partial<InsertGhlAppointmentSync>): Promise<GhlAppointmentSync | undefined>;
  getPendingGhlAppointmentSyncs(dealershipId: number, limit?: number): Promise<GhlAppointmentSync[]>;
  
  // GHL API Logs - Multi-Tenant
  createGhlApiLog(log: InsertGhlApiLog): Promise<GhlApiLog>;
  getGhlApiLogs(dealershipId: number, limit?: number): Promise<GhlApiLog[]>;
  
  // AI prompt templates
  saveAIPromptTemplate(template: InsertAiPromptTemplate): Promise<AiPromptTemplate>;
  
  // Chat conversations (Multi-Tenant)
  saveChatConversation(conversation: InsertChatConversation): Promise<ChatConversation>; // Must include dealershipId
  getAllConversations(dealershipId: number, category?: string, limit?: number, offset?: number): Promise<{ conversations: ChatConversation[]; total: number }>; // REQUIRED filtering
  getConversationById(id: number, dealershipId: number): Promise<ChatConversation | undefined>; // REQUIRED filtering
  updateConversationHandoff(id: number, dealershipId: number, data: { handoffRequested?: boolean; handoffPhone?: string; handoffSent?: boolean; handoffSentAt?: Date }): Promise<ChatConversation | undefined>;
  
  // Messenger conversations (Multi-Tenant)
  getMessengerConversations(dealershipId: number, userId?: number, userRole?: string): Promise<(MessengerConversation & { ownerName?: string })[]>;
  createMessengerConversation(conversation: InsertMessengerConversation): Promise<MessengerConversation>;
  updateMessengerConversation(id: number, dealershipId: number, data: Partial<InsertMessengerConversation>): Promise<MessengerConversation | undefined>;
  
  // Chat prompts (Multi-Tenant)
  getChatPrompts(dealershipId: number): Promise<ChatPrompt[]>;
  getAllChatPrompts(dealershipId: number): Promise<ChatPrompt[]>; // Include inactive prompts for admin
  getChatPromptByScenario(scenario: string, dealershipId: number): Promise<ChatPrompt | undefined>;
  getChatPromptById(id: number, dealershipId: number): Promise<ChatPrompt | undefined>;
  getActivePromptForScenario(dealershipId: number, scenario: string): Promise<ChatPrompt | undefined>;
  saveChatPrompt(prompt: InsertChatPrompt): Promise<ChatPrompt>;
  updateChatPrompt(scenario: string, dealershipId: number, prompt: Partial<InsertChatPrompt>): Promise<ChatPrompt | undefined>;
  updateChatPromptById(id: number, dealershipId: number, prompt: Partial<InsertChatPrompt>): Promise<ChatPrompt | undefined>;
  deleteChatPrompt(id: number, dealershipId: number): Promise<boolean>;
  
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
  getUsersByDealership(dealershipId: number): Promise<User[]>; // Get all users for a specific dealership
  
  // Super Admin User Management
  getAllUsersForSuperAdmin(filters?: { dealershipId?: number; role?: string; search?: string }): Promise<(User & { dealershipName?: string })[]>;
  deleteUser(userId: number): Promise<boolean>;
  updateUserStatus(userId: number, isActive: boolean): Promise<User | undefined>;
  updateUserPassword(userId: number, passwordHash: string): Promise<boolean>;
  
  // Financing rules - Credit score tiers (Multi-Tenant)
  getCreditScoreTiers(dealershipId: number): Promise<CreditScoreTier[]>;
  createCreditScoreTier(tier: InsertCreditScoreTier): Promise<CreditScoreTier>;
  updateCreditScoreTier(id: number, dealershipId: number, tier: Partial<InsertCreditScoreTier>): Promise<CreditScoreTier | undefined>;
  deleteCreditScoreTier(id: number, dealershipId: number): Promise<boolean>;
  getInterestRateForCreditScore(dealershipId: number, score: number): Promise<number | null>;
  
  // Financing rules - Model year terms (Multi-Tenant)
  getModelYearTerms(dealershipId: number): Promise<ModelYearTerm[]>;
  createModelYearTerm(term: InsertModelYearTerm): Promise<ModelYearTerm>;
  updateModelYearTerm(id: number, dealershipId: number, term: Partial<InsertModelYearTerm>): Promise<ModelYearTerm | undefined>;
  deleteModelYearTerm(id: number, dealershipId: number): Promise<boolean>;
  getAvailableTermsForYear(dealershipId: number, modelYear: number): Promise<string[]>;
  
  // Dealership Fees (Multi-Tenant)
  getDealershipFees(dealershipId: number): Promise<DealershipFee[]>;
  createDealershipFee(fee: InsertDealershipFee): Promise<DealershipFee>;
  updateDealershipFee(id: number, dealershipId: number, fee: Partial<InsertDealershipFee>): Promise<DealershipFee | undefined>;
  deleteDealershipFee(id: number, dealershipId: number): Promise<boolean>;
  getActiveDealershipFees(dealershipId: number): Promise<DealershipFee[]>;
  
  // Scrape Sources (Multi-Tenant)
  getScrapeSources(dealershipId: number): Promise<ScrapeSource[]>;
  createScrapeSource(source: InsertScrapeSource): Promise<ScrapeSource>;
  updateScrapeSource(id: number, dealershipId: number, source: Partial<InsertScrapeSource>): Promise<ScrapeSource | undefined>;
  updateScrapeSourceAdmin(id: number, source: Partial<InsertScrapeSource>): Promise<ScrapeSource | undefined>;
  deleteScrapeSource(id: number, dealershipId: number): Promise<boolean>;
  deleteScrapeSourceAdmin(id: number): Promise<boolean>;
  getActiveScrapeSources(dealershipId: number): Promise<ScrapeSource[]>;
  getAllActiveScrapeSources(): Promise<ScrapeSource[]>;
  getAllScrapeSources(): Promise<ScrapeSource[]>;
  updateScrapeSourceStats(id: number, vehicleCount: number): Promise<void>;
  
  // Facebook Accounts (Multi-Tenant - Defense-in-Depth)
  getFacebookAccountsByUser(userId: number, dealershipId: number): Promise<FacebookAccount[]>;
  getAllFacebookAccountsByDealership(dealershipId: number): Promise<FacebookAccount[]>;
  getFacebookAccountById(id: number, userId: number, dealershipId: number): Promise<FacebookAccount | undefined>;
  createFacebookAccount(account: InsertFacebookAccount): Promise<FacebookAccount>;
  updateFacebookAccount(id: number, userId: number, dealershipId: number, account: Partial<InsertFacebookAccount>): Promise<FacebookAccount | undefined>;
  updateFacebookAccountDirect(id: number, account: Partial<InsertFacebookAccount>): Promise<FacebookAccount | undefined>;
  deleteFacebookAccount(id: number, userId: number, dealershipId: number): Promise<boolean>;
  
  // Ad Templates (Multi-Tenant - Defense-in-Depth)
  getAdTemplatesByUser(userId: number, dealershipId: number): Promise<AdTemplate[]>;
  getAdTemplateById(id: number, userId: number, dealershipId: number): Promise<AdTemplate | undefined>;
  createAdTemplate(template: InsertAdTemplate): Promise<AdTemplate>;
  updateAdTemplate(id: number, userId: number, dealershipId: number, template: Partial<InsertAdTemplate>): Promise<AdTemplate | undefined>;
  deleteAdTemplate(id: number, userId: number, dealershipId: number): Promise<boolean>;
  
  // Posting Queue (Multi-Tenant - Defense-in-Depth)
  getPostingQueueByUser(userId: number, dealershipId: number): Promise<PostingQueue[]>;
  getPostingQueueItem(id: number, dealershipId: number): Promise<PostingQueue | undefined>;
  createPostingQueueItem(item: InsertPostingQueue): Promise<PostingQueue>;
  updatePostingQueueItem(id: number, userId: number, dealershipId: number, item: Partial<InsertPostingQueue>): Promise<PostingQueue | undefined>;
  deletePostingQueueItem(id: number, userId: number, dealershipId: number): Promise<boolean>;
  getNextQueuedPost(userId: number, dealershipId: number): Promise<PostingQueue | undefined>;
  
  // Posting Schedule (Multi-Tenant - Defense-in-Depth)
  getPostingScheduleByUser(userId: number, dealershipId: number): Promise<PostingSchedule | undefined>;
  getAllPostingSchedules(dealershipId: number): Promise<PostingSchedule[]>;
  createPostingSchedule(schedule: InsertPostingSchedule): Promise<PostingSchedule>;
  updatePostingSchedule(userId: number, dealershipId: number, schedule: Partial<InsertPostingSchedule>): Promise<PostingSchedule | undefined>;
  
  // Remarketing Vehicles (Multi-Tenant)
  getRemarketingVehicles(dealershipId: number): Promise<RemarketingVehicle[]>; // REQUIRED filtering
  addRemarketingVehicle(vehicle: InsertRemarketingVehicle): Promise<RemarketingVehicle>; // Must include dealershipId
  updateRemarketingVehicle(id: number, dealershipId: number, vehicle: Partial<InsertRemarketingVehicle>): Promise<RemarketingVehicle | undefined>;
  removeRemarketingVehicle(id: number, dealershipId: number): Promise<boolean>;
  getRemarketingVehicleCount(dealershipId: number): Promise<number>; // REQUIRED filtering
  
  // PBS DMS Integration (Multi-Tenant)
  getPbsConfig(dealershipId: number): Promise<PbsConfig | undefined>;
  createPbsConfig(config: InsertPbsConfig): Promise<PbsConfig>;
  updatePbsConfig(id: number, dealershipId: number, config: Partial<InsertPbsConfig>): Promise<PbsConfig | undefined>;
  deletePbsConfig(id: number, dealershipId: number): Promise<boolean>;
  
  // PBS Webhook Events (Multi-Tenant)
  getPbsWebhookEvents(dealershipId: number, limit?: number): Promise<PbsWebhookEvent[]>;
  getPbsWebhookEventById(id: number, dealershipId: number): Promise<PbsWebhookEvent | undefined>;
  createPbsWebhookEvent(event: InsertPbsWebhookEvent): Promise<PbsWebhookEvent>;
  updatePbsWebhookEvent(id: number, dealershipId: number, event: Partial<InsertPbsWebhookEvent>): Promise<PbsWebhookEvent | undefined>;
  
  // PBS Sessions (Multi-Tenant)
  getPbsSession(dealershipId: number): Promise<PbsSession | undefined>;
  createPbsSession(session: InsertPbsSession): Promise<PbsSession>;
  updatePbsSessionLastUsed(id: number, dealershipId: number): Promise<void>;
  deletePbsSession(id: number, dealershipId: number): Promise<boolean>;
  deleteExpiredPbsSessions(dealershipId: number): Promise<number>;

  // PBS Contact Cache (Multi-Tenant)
  getPbsContactByPbsId(dealershipId: number, pbsContactId: string): Promise<PbsContactCache | undefined>;
  getPbsContactByPhone(dealershipId: number, phone: string): Promise<PbsContactCache | undefined>;
  getPbsContactByEmail(dealershipId: number, email: string): Promise<PbsContactCache | undefined>;
  createPbsContactCache(contact: InsertPbsContactCache): Promise<PbsContactCache>;
  updatePbsContactCache(id: number, dealershipId: number, contact: Partial<InsertPbsContactCache>): Promise<PbsContactCache | undefined>;
  deleteExpiredPbsContactCache(dealershipId: number): Promise<number>;

  // PBS Appointment Cache (Multi-Tenant)
  getPbsAppointmentByPbsId(dealershipId: number, pbsAppointmentId: string): Promise<PbsAppointmentCache | undefined>;
  getPbsAppointmentsByContact(dealershipId: number, pbsContactId: string): Promise<PbsAppointmentCache[]>;
  createPbsAppointmentCache(appointment: InsertPbsAppointmentCache): Promise<PbsAppointmentCache>;
  updatePbsAppointmentCache(id: number, dealershipId: number, appointment: Partial<InsertPbsAppointmentCache>): Promise<PbsAppointmentCache | undefined>;
  deleteExpiredPbsAppointmentCache(dealershipId: number): Promise<number>;

  // PBS Parts Cache (Multi-Tenant)
  getPbsPartByNumber(dealershipId: number, partNumber: string): Promise<PbsPartsCache | undefined>;
  searchPbsParts(dealershipId: number, query: string): Promise<PbsPartsCache[]>;
  createPbsPartsCache(part: InsertPbsPartsCache): Promise<PbsPartsCache>;
  updatePbsPartsCache(id: number, dealershipId: number, part: Partial<InsertPbsPartsCache>): Promise<PbsPartsCache | undefined>;
  deleteExpiredPbsPartsCache(dealershipId: number): Promise<number>;

  // PBS API Logs (Multi-Tenant)
  createPbsApiLog(log: InsertPbsApiLog): Promise<PbsApiLog>;
  getPbsApiLogs(dealershipId: number, limit?: number): Promise<PbsApiLog[]>;

  // Manager Settings (Multi-Tenant)
  getManagerSettings(userId: number, dealershipId: number): Promise<ManagerSettings | undefined>;
  getManagerSettingsByDealership(dealershipId: number): Promise<ManagerSettings | undefined>;
  createManagerSettings(settings: InsertManagerSettings): Promise<ManagerSettings>;
  updateManagerSettings(userId: number, dealershipId: number, settings: Partial<InsertManagerSettings>): Promise<ManagerSettings | undefined>;
  
  // Market Listings (Multi-Tenant)
  getMarketListings(dealershipId: number, filters: { make?: string; model?: string; yearMin?: number; yearMax?: number; source?: string }, limit?: number, offset?: number): Promise<{ listings: MarketListing[]; total: number }>;
  getMarketListingById(id: number, dealershipId: number): Promise<MarketListing | undefined>;
  getMarketListingsByUrls(dealershipId: number, urls: string[]): Promise<MarketListing[]>;
  createMarketListing(listing: InsertMarketListing): Promise<MarketListing>;
  updateMarketListing(id: number, dealershipId: number, listing: Partial<InsertMarketListing>): Promise<MarketListing | undefined>;
  deactivateMarketListing(dealershipId: number, url: string): Promise<boolean>;
  deleteOldMarketListings(dealershipId: number, daysOld: number): Promise<number>;
  
  // External API Tokens (Multi-Tenant)
  getExternalApiTokens(dealershipId: number): Promise<ExternalApiToken[]>;
  getExternalApiTokenById(id: number, dealershipId: number): Promise<ExternalApiToken | undefined>;
  getExternalApiTokenByPrefix(prefix: string): Promise<ExternalApiToken | undefined>;
  createExternalApiToken(token: InsertExternalApiToken): Promise<ExternalApiToken>;
  updateExternalApiToken(id: number, dealershipId: number, token: Partial<InsertExternalApiToken>): Promise<ExternalApiToken | undefined>;
  deleteExternalApiToken(id: number, dealershipId: number): Promise<boolean>;
  updateExternalApiTokenLastUsed(id: number): Promise<void>;
  
  // Staff Invites
  getStaffInviteByToken(token: string): Promise<StaffInvite | undefined>;
  acceptStaffInvite(id: number): Promise<void>;
  getDealershipById(id: number): Promise<Dealership | undefined>;
  
  // Launch Checklist (Multi-Tenant)
  getLaunchChecklist(dealershipId: number): Promise<LaunchChecklist[]>;
  getLaunchChecklistByCategory(dealershipId: number, category: string): Promise<LaunchChecklist[]>;
  getLaunchChecklistProgress(dealershipId: number): Promise<{ total: number; completed: number; required: number; requiredCompleted: number }>;
  createLaunchChecklistItem(item: InsertLaunchChecklist): Promise<LaunchChecklist>;
  createLaunchChecklistItems(items: InsertLaunchChecklist[]): Promise<LaunchChecklist[]>;
  updateLaunchChecklistItem(id: number, dealershipId: number, item: Partial<InsertLaunchChecklist>): Promise<LaunchChecklist | undefined>;
  completeLaunchChecklistItem(id: number, dealershipId: number, userId: number): Promise<LaunchChecklist | undefined>;
  skipLaunchChecklistItem(id: number, dealershipId: number, notes?: string): Promise<LaunchChecklist | undefined>;
  deleteLaunchChecklistItem(id: number, dealershipId: number): Promise<boolean>;
  
  // Price History (Multi-Tenant)
  getPriceHistory(dealershipId: number, filters: { make?: string; model?: string; externalId?: string }, limit?: number): Promise<PriceHistory[]>;
  createPriceHistory(record: InsertPriceHistory): Promise<PriceHistory>;
  createPriceHistoryBatch(records: InsertPriceHistory[]): Promise<PriceHistory[]>;
  getPriceHistoryForListing(dealershipId: number, externalId: string): Promise<PriceHistory[]>;
  
  // Competitor Dealers (Multi-Tenant)
  getCompetitorDealers(dealershipId: number): Promise<CompetitorDealer[]>;
  getCompetitorDealerById(id: number, dealershipId: number): Promise<CompetitorDealer | undefined>;
  createCompetitorDealer(dealer: InsertCompetitorDealer): Promise<CompetitorDealer>;
  updateCompetitorDealer(id: number, dealershipId: number, dealer: Partial<InsertCompetitorDealer>): Promise<CompetitorDealer | undefined>;
  deleteCompetitorDealer(id: number, dealershipId: number): Promise<boolean>;
  
  // Market Snapshots (Multi-Tenant)
  getMarketSnapshots(dealershipId: number, filters: { make?: string; model?: string; limit?: number }): Promise<MarketSnapshot[]>;
  createMarketSnapshot(snapshot: InsertMarketSnapshot): Promise<MarketSnapshot>;
  getLatestMarketSnapshot(dealershipId: number, make: string, model: string): Promise<MarketSnapshot | undefined>;
  getLatestMarketSnapshotDate(dealershipId: number): Promise<Date | null>;
}

export class DatabaseStorage implements IStorage {
  // ====== DEALERSHIP MANAGEMENT ======
  async getDealership(id: number): Promise<Dealership | undefined> {
    // Database columns: id, name, slug, subdomain, is_active, created_at, updated_at
    const result = await db.execute(
      sql`SELECT id, name, slug, subdomain, is_active, created_at, updated_at 
          FROM dealerships WHERE id = ${id} LIMIT 1`
    );
    return result.rows[0] as any;
  }

  async getDealershipBySlug(slug: string): Promise<Dealership | undefined> {
    const result = await db.execute(
      sql`SELECT id, name, slug, subdomain, is_active, created_at, updated_at 
          FROM dealerships WHERE slug = ${slug} LIMIT 1`
    );
    return result.rows[0] as any;
  }

  async getDealershipBySubdomain(subdomain: string): Promise<Dealership | undefined> {
    const result = await db.execute(
      sql`SELECT id, name, slug, subdomain, is_active, created_at, updated_at 
          FROM dealerships WHERE subdomain = ${subdomain} LIMIT 1`
    );
    return result.rows[0] as any;
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
  async getVehicles(dealershipId: number, limit: number = 50, offset: number = 0): Promise<{ vehicles: Vehicle[]; total: number }> {
    // Get total count for pagination metadata
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(vehicles)
      .where(eq(vehicles.dealershipId, dealershipId));
    
    // Get paginated vehicles
    const vehiclesList = await db.select().from(vehicles)
      .where(eq(vehicles.dealershipId, dealershipId))
      .orderBy(desc(vehicles.createdAt))
      .limit(limit)
      .offset(offset);
    
    return {
      vehicles: vehiclesList,
      total: count
    };
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

  async getVehicleByVin(vin: string, dealershipId: number): Promise<Vehicle | undefined> {
    // Normalize VIN: uppercase and trim whitespace for consistent matching
    const normalizedVin = vin.trim().toUpperCase();
    const result = await db.select().from(vehicles)
      .where(and(
        sql`UPPER(TRIM(${vehicles.vin})) = ${normalizedVin}`,
        eq(vehicles.dealershipId, dealershipId)
      ))
      .limit(1);
    return result[0];
  }

  async deleteVehiclesByVinNotIn(vins: string[], dealershipId: number): Promise<{ deletedCount: number; deletedVins: string[] }> {
    // Normalize all VINs for comparison
    const normalizedVins = vins.map(v => v.trim().toUpperCase()).filter(v => v.length > 0);
    
    // SAFETY: If no valid VINs provided, refuse to execute (would delete everything)
    if (normalizedVins.length === 0) {
      throw new Error('Cannot execute sync with empty VIN list - this would delete all vehicles');
    }
    
    // Get vehicles that will be deleted (for reporting)
    // Using parameterized array to prevent SQL injection
    const toDelete = await db.select({ id: vehicles.id, vin: vehicles.vin })
      .from(vehicles)
      .where(and(
        eq(vehicles.dealershipId, dealershipId),
        sql`${vehicles.vin} IS NOT NULL`,
        sql`UPPER(TRIM(${vehicles.vin})) != ALL(${normalizedVins}::text[])`
      ));
    
    if (toDelete.length === 0) {
      return { deletedCount: 0, deletedVins: [] };
    }
    
    // Delete in one efficient query using parameterized array
    const idsToDelete = toDelete.map(v => v.id);
    await db.delete(vehicles).where(and(
      eq(vehicles.dealershipId, dealershipId),
      sql`${vehicles.id} = ANY(${idsToDelete}::int[])`
    ));
    
    return {
      deletedCount: toDelete.length,
      deletedVins: toDelete.map(v => v.vin).filter((v): v is string => v !== null)
    };
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
  async getFacebookPages(dealershipId?: number): Promise<FacebookPage[]> {
    if (dealershipId) {
      return await db.select().from(facebookPages).where(
        and(eq(facebookPages.dealershipId, dealershipId), eq(facebookPages.isActive, true))
      );
    }
    return await db.select().from(facebookPages).where(eq(facebookPages.isActive, true));
  }

  async getFacebookPageByPageId(pageId: string): Promise<FacebookPage | undefined> {
    const result = await db.select().from(facebookPages).where(eq(facebookPages.pageId, pageId));
    return result[0];
  }

  async createFacebookPage(page: InsertFacebookPage): Promise<FacebookPage> {
    const result = await db.insert(facebookPages).values(page).returning();
    return result[0];
  }

  async updateFacebookPage(id: number, page: Partial<InsertFacebookPage>): Promise<FacebookPage | undefined> {
    const result = await db.update(facebookPages).set(page).where(eq(facebookPages.id, id)).returning();
    return result[0];
  }

  // Facebook Catalog Config (for Automotive Inventory Ads)
  async getFacebookCatalogConfig(dealershipId: number): Promise<FacebookCatalogConfig | undefined> {
    const result = await db.select().from(facebookCatalogConfig).where(eq(facebookCatalogConfig.dealershipId, dealershipId));
    return result[0];
  }

  async getAllFacebookCatalogConfigs(): Promise<(FacebookCatalogConfig & { dealershipName?: string })[]> {
    const result = await db.select({
      id: facebookCatalogConfig.id,
      dealershipId: facebookCatalogConfig.dealershipId,
      catalogId: facebookCatalogConfig.catalogId,
      accessToken: facebookCatalogConfig.accessToken,
      catalogName: facebookCatalogConfig.catalogName,
      isActive: facebookCatalogConfig.isActive,
      lastSyncAt: facebookCatalogConfig.lastSyncAt,
      lastSyncStatus: facebookCatalogConfig.lastSyncStatus,
      lastSyncMessage: facebookCatalogConfig.lastSyncMessage,
      vehiclesSynced: facebookCatalogConfig.vehiclesSynced,
      autoSyncEnabled: facebookCatalogConfig.autoSyncEnabled,
      createdAt: facebookCatalogConfig.createdAt,
      updatedAt: facebookCatalogConfig.updatedAt,
      dealershipName: dealerships.name,
    }).from(facebookCatalogConfig)
      .leftJoin(dealerships, eq(facebookCatalogConfig.dealershipId, dealerships.id));
    return result.map(r => ({
      ...r,
      dealershipName: r.dealershipName ?? undefined,
    }));
  }

  async saveFacebookCatalogConfig(config: InsertFacebookCatalogConfig): Promise<FacebookCatalogConfig> {
    const result = await db.insert(facebookCatalogConfig).values(config)
      .onConflictDoUpdate({
        target: facebookCatalogConfig.dealershipId,
        set: {
          catalogId: config.catalogId,
          accessToken: config.accessToken,
          catalogName: config.catalogName,
          isActive: config.isActive,
          autoSyncEnabled: config.autoSyncEnabled,
          updatedAt: new Date(),
        }
      })
      .returning();
    return result[0];
  }

  async updateFacebookCatalogConfig(dealershipId: number, config: Partial<InsertFacebookCatalogConfig>): Promise<FacebookCatalogConfig | undefined> {
    const result = await db.update(facebookCatalogConfig)
      .set({ ...config, updatedAt: new Date() })
      .where(eq(facebookCatalogConfig.dealershipId, dealershipId))
      .returning();
    return result[0];
  }

  async updateCatalogSyncStatus(dealershipId: number, status: { lastSyncAt?: Date; lastSyncStatus?: string; lastSyncMessage?: string; vehiclesSynced?: number }): Promise<FacebookCatalogConfig | undefined> {
    const result = await db.update(facebookCatalogConfig)
      .set({ ...status, updatedAt: new Date() })
      .where(eq(facebookCatalogConfig.dealershipId, dealershipId))
      .returning();
    return result[0];
  }

  async deleteFacebookCatalogConfig(dealershipId: number): Promise<boolean> {
    const result = await db.delete(facebookCatalogConfig)
      .where(eq(facebookCatalogConfig.dealershipId, dealershipId))
      .returning();
    return result.length > 0;
  }

  // Priority vehicles
  async getPagePriorityVehicles(pageId: number): Promise<PagePriorityVehicle[]> {
    return await db.select().from(pagePriorityVehicles).where(eq(pagePriorityVehicles.pageId, pageId));
  }

  async setPagePriorityVehicles(pageId: number, vehicleIds: number[]): Promise<void> {
    // LEGACY/DEPRECATED: Page priority vehicles are being replaced by remarketing system
    // TODO: Multi-tenant - hardcoded dealershipId for single-dealership
    const dealershipId = 1;
    
    // Delete existing priorities
    await db.delete(pagePriorityVehicles).where(eq(pagePriorityVehicles.pageId, pageId));
    
    // Insert new priorities
    if (vehicleIds.length > 0) {
      await db.insert(pagePriorityVehicles).values(
        vehicleIds.map((vehicleId, index) => ({
          dealershipId,
          pageId,
          vehicleId,
          priority: index + 1
        }))
      );
    }
  }

  // GoHighLevel config (Legacy - use createGhlConfig for new code)
  async saveGHLConfig(config: InsertGhlConfig): Promise<GhlConfig> {
    // Check if config exists for this dealership, upsert if so
    if (config.dealershipId) {
      const existing = await this.getGhlConfig(config.dealershipId);
      if (existing) {
        const updated = await this.updateGhlConfig(existing.id, config.dealershipId, config);
        if (updated) return updated;
      }
    }
    
    // Insert new config
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

  async getActiveGHLWebhookConfig(dealershipId: number): Promise<GhlWebhookConfig | undefined> {
    const result = await db.select().from(ghlWebhookConfig)
      .where(and(
        eq(ghlWebhookConfig.dealershipId, dealershipId),
        eq(ghlWebhookConfig.isActive, true)
      ))
      .limit(1);
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

  async getAllConversations(dealershipId: number, category?: string, limit: number = 50, offset: number = 0): Promise<{ conversations: ChatConversation[]; total: number }> {
    // REQUIRED: Only return conversations from specific dealership
    const conditions = category
      ? and(eq(chatConversations.dealershipId, dealershipId), eq(chatConversations.category, category))
      : eq(chatConversations.dealershipId, dealershipId);
    
    // Get total count
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(chatConversations)
      .where(conditions);
    
    // Get paginated conversations
    const conversations = await db.select().from(chatConversations)
      .where(conditions)
      .orderBy(desc(chatConversations.createdAt))
      .limit(limit)
      .offset(offset);
    
    return {
      conversations,
      total: count
    };
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

  // Messenger conversations (Multi-Tenant with role-based filtering)
  async getMessengerConversations(dealershipId: number, userId?: number, userRole?: string): Promise<(MessengerConversation & { ownerName?: string })[]> {
    // For managers (manager, general_manager, super_admin), show all conversations
    // For salespeople, only show conversations from their connected Facebook accounts
    if (userRole === 'salesperson' && userId) {
      // Get Facebook accounts owned by this salesperson
      const userAccounts = await db.select()
        .from(facebookAccounts)
        .where(and(
          eq(facebookAccounts.userId, userId),
          eq(facebookAccounts.dealershipId, dealershipId)
        ));
      
      if (userAccounts.length === 0) {
        return [];
      }
      
      const accountIds = userAccounts.map(a => a.id);
      
      // Get conversations only from those accounts
      const conversations = await db.select({
        id: messengerConversations.id,
        dealershipId: messengerConversations.dealershipId,
        facebookAccountId: messengerConversations.facebookAccountId,
        pageId: messengerConversations.pageId,
        pageName: messengerConversations.pageName,
        conversationId: messengerConversations.conversationId,
        participantName: messengerConversations.participantName,
        participantId: messengerConversations.participantId,
        lastMessage: messengerConversations.lastMessage,
        lastMessageAt: messengerConversations.lastMessageAt,
        unreadCount: messengerConversations.unreadCount,
        status: messengerConversations.status,
        createdAt: messengerConversations.createdAt,
        updatedAt: messengerConversations.updatedAt,
        ownerName: users.name
      })
        .from(messengerConversations)
        .innerJoin(facebookAccounts, eq(messengerConversations.facebookAccountId, facebookAccounts.id))
        .innerJoin(users, eq(facebookAccounts.userId, users.id))
        .where(and(
          eq(messengerConversations.dealershipId, dealershipId),
          inArray(messengerConversations.facebookAccountId, accountIds)
        ))
        .orderBy(desc(messengerConversations.lastMessageAt));
      
      return conversations;
    }
    
    // Managers see all conversations in the dealership
    const conversations = await db.select({
      id: messengerConversations.id,
      dealershipId: messengerConversations.dealershipId,
      facebookAccountId: messengerConversations.facebookAccountId,
      pageId: messengerConversations.pageId,
      pageName: messengerConversations.pageName,
      conversationId: messengerConversations.conversationId,
      participantName: messengerConversations.participantName,
      participantId: messengerConversations.participantId,
      lastMessage: messengerConversations.lastMessage,
      lastMessageAt: messengerConversations.lastMessageAt,
      unreadCount: messengerConversations.unreadCount,
      status: messengerConversations.status,
      createdAt: messengerConversations.createdAt,
      updatedAt: messengerConversations.updatedAt,
      ownerName: users.name
    })
      .from(messengerConversations)
      .innerJoin(facebookAccounts, eq(messengerConversations.facebookAccountId, facebookAccounts.id))
      .innerJoin(users, eq(facebookAccounts.userId, users.id))
      .where(eq(messengerConversations.dealershipId, dealershipId))
      .orderBy(desc(messengerConversations.lastMessageAt));
    
    return conversations;
  }

  async createMessengerConversation(conversation: InsertMessengerConversation): Promise<MessengerConversation> {
    if (!conversation.dealershipId) {
      throw new Error('dealershipId is required when creating messenger conversations');
    }
    const result = await db.insert(messengerConversations).values(conversation).returning();
    return result[0];
  }

  async updateMessengerConversation(id: number, dealershipId: number, data: Partial<InsertMessengerConversation>): Promise<MessengerConversation | undefined> {
    const result = await db.update(messengerConversations)
      .set({ ...data, updatedAt: new Date() })
      .where(and(
        eq(messengerConversations.id, id),
        eq(messengerConversations.dealershipId, dealershipId)
      ))
      .returning();
    return result[0];
  }

  // Chat prompts (Multi-Tenant)
  async getChatPrompts(dealershipId: number): Promise<ChatPrompt[]> {
    // REQUIRED: Filter by dealership to prevent cross-tenant access
    return await db.select().from(chatPrompts)
      .where(and(
        eq(chatPrompts.isActive, true),
        eq(chatPrompts.dealershipId, dealershipId)
      ));
  }

  async getChatPromptByScenario(scenario: string, dealershipId: number): Promise<ChatPrompt | undefined> {
    // REQUIRED: Filter by dealership to prevent cross-tenant access
    const result = await db.select().from(chatPrompts)
      .where(and(
        eq(chatPrompts.scenario, scenario),
        eq(chatPrompts.dealershipId, dealershipId)
      ))
      .limit(1);
    return result[0];
  }

  async saveChatPrompt(prompt: InsertChatPrompt): Promise<ChatPrompt> {
    // Validate dealershipId is present before insert
    if (!prompt.dealershipId) {
      throw new Error('dealershipId is required when creating chat prompts');
    }
    const result = await db.insert(chatPrompts).values(prompt).returning();
    return result[0];
  }

  async getActivePromptForScenario(dealershipId: number, scenario: string): Promise<ChatPrompt | undefined> {
    // REQUIRED: Filter by dealership to prevent cross-tenant access
    const result = await db.select().from(chatPrompts)
      .where(and(
        eq(chatPrompts.dealershipId, dealershipId),
        eq(chatPrompts.scenario, scenario),
        eq(chatPrompts.isActive, true)
      ))
      .limit(1);
    return result[0];
  }

  async updateChatPrompt(scenario: string, dealershipId: number, prompt: Partial<InsertChatPrompt>): Promise<ChatPrompt | undefined> {
    // REQUIRED: Only update prompts for this dealership
    const result = await db.update(chatPrompts).set(prompt)
      .where(and(
        eq(chatPrompts.scenario, scenario),
        eq(chatPrompts.dealershipId, dealershipId)
      ))
      .returning();
    return result[0];
  }

  async updateChatPromptById(id: number, dealershipId: number, prompt: Partial<InsertChatPrompt>): Promise<ChatPrompt | undefined> {
    // REQUIRED: Filter by dealership to prevent cross-tenant access
    const result = await db.update(chatPrompts).set({ ...prompt, updatedAt: new Date() })
      .where(and(
        eq(chatPrompts.id, id),
        eq(chatPrompts.dealershipId, dealershipId)
      ))
      .returning();
    return result[0];
  }

  async getAllChatPrompts(dealershipId: number): Promise<ChatPrompt[]> {
    // REQUIRED: Filter by dealership - includes inactive prompts for admin
    return await db.select().from(chatPrompts)
      .where(eq(chatPrompts.dealershipId, dealershipId))
      .orderBy(chatPrompts.scenario);
  }

  async getChatPromptById(id: number, dealershipId: number): Promise<ChatPrompt | undefined> {
    // REQUIRED: Filter by dealership to prevent cross-tenant access
    const result = await db.select().from(chatPrompts)
      .where(and(
        eq(chatPrompts.id, id),
        eq(chatPrompts.dealershipId, dealershipId)
      ))
      .limit(1);
    return result[0];
  }

  async deleteChatPrompt(id: number, dealershipId: number): Promise<boolean> {
    // REQUIRED: Filter by dealership to prevent cross-tenant deletion
    const result = await db.delete(chatPrompts)
      .where(and(
        eq(chatPrompts.id, id),
        eq(chatPrompts.dealershipId, dealershipId)
      ))
      .returning();
    return result.length > 0;
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
    // Ensure dealershipId is set for non-privileged users
    // super_admin and master users can have null dealershipId
    if (!user.dealershipId && user.role !== 'master' && user.role !== 'super_admin') {
      throw new Error('dealershipId is required when creating a non-privileged user');
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

  async getUsersByDealership(dealershipId: number): Promise<User[]> {
    return await db.select().from(users)
      .where(eq(users.dealershipId, dealershipId))
      .orderBy(desc(users.createdAt));
  }
  
  // ====== SUPER ADMIN USER MANAGEMENT ======
  async getAllUsersForSuperAdmin(filters?: { dealershipId?: number; role?: string; search?: string }): Promise<(User & { dealershipName?: string })[]> {
    // Build dynamic conditions
    const conditions = [];
    
    if (filters?.dealershipId) {
      conditions.push(eq(users.dealershipId, filters.dealershipId));
    }
    
    if (filters?.role) {
      conditions.push(eq(users.role, filters.role));
    }
    
    // Get all users with dealership info
    const allUsers = await db
      .select({
        user: users,
        dealershipName: dealerships.name
      })
      .from(users)
      .leftJoin(dealerships, eq(users.dealershipId, dealerships.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(users.dealershipId, users.role, desc(users.createdAt));
    
    // Filter by search if provided
    let result = allUsers.map(row => ({
      ...row.user,
      dealershipName: row.dealershipName || undefined
    }));
    
    if (filters?.search) {
      const searchLower = filters.search.toLowerCase();
      result = result.filter(u => 
        u.email.toLowerCase().includes(searchLower) ||
        u.name.toLowerCase().includes(searchLower)
      );
    }
    
    return result;
  }
  
  async deleteUser(userId: number): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, userId)).returning();
    return result.length > 0;
  }
  
  async updateUserStatus(userId: number, isActive: boolean): Promise<User | undefined> {
    const result = await db.update(users)
      .set({ isActive, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return result[0];
  }
  
  async updateUserPassword(userId: number, passwordHash: string): Promise<boolean> {
    const result = await db.update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return result.length > 0;
  }

  // ====== FINANCING RULES - CREDIT SCORE TIERS (Multi-Tenant) ======
  async getCreditScoreTiers(dealershipId: number): Promise<CreditScoreTier[]> {
    // REQUIRED: Only return credit score tiers for specific dealership
    return await db.select().from(creditScoreTiers)
      .where(and(
        eq(creditScoreTiers.dealershipId, dealershipId),
        eq(creditScoreTiers.isActive, true)
      ))
      .orderBy(creditScoreTiers.minScore);
  }

  async createCreditScoreTier(tier: InsertCreditScoreTier): Promise<CreditScoreTier> {
    // Validate dealershipId is present before insert
    if (!tier.dealershipId) {
      throw new Error('dealershipId is required when creating a credit score tier');
    }
    const result = await db.insert(creditScoreTiers).values(tier).returning();
    return result[0];
  }

  async updateCreditScoreTier(id: number, dealershipId: number, tier: Partial<InsertCreditScoreTier>): Promise<CreditScoreTier | undefined> {
    // REQUIRED: Only update tiers for this dealership
    const result = await db.update(creditScoreTiers)
      .set({ ...tier, updatedAt: new Date() })
      .where(and(
        eq(creditScoreTiers.id, id),
        eq(creditScoreTiers.dealershipId, dealershipId)
      ))
      .returning();
    return result[0];
  }

  async deleteCreditScoreTier(id: number, dealershipId: number): Promise<boolean> {
    // REQUIRED: Soft delete only for this dealership
    await db.update(creditScoreTiers)
      .set({ isActive: false })
      .where(and(
        eq(creditScoreTiers.id, id),
        eq(creditScoreTiers.dealershipId, dealershipId)
      ));
    return true;
  }

  async getInterestRateForCreditScore(dealershipId: number, score: number): Promise<number | null> {
    // REQUIRED: Only check tiers for specific dealership
    const result = await db
      .select()
      .from(creditScoreTiers)
      .where(
        and(
          eq(creditScoreTiers.dealershipId, dealershipId),
          eq(creditScoreTiers.isActive, true),
          lte(creditScoreTiers.minScore, score),
          gte(creditScoreTiers.maxScore, score)
        )
      )
      .limit(1);
    
    return result[0]?.interestRate ?? null;
  }

  // ====== FINANCING RULES - MODEL YEAR TERMS (Multi-Tenant) ======
  async getModelYearTerms(dealershipId: number): Promise<ModelYearTerm[]> {
    // REQUIRED: Only return model year terms for specific dealership
    return await db.select().from(modelYearTerms)
      .where(and(
        eq(modelYearTerms.dealershipId, dealershipId),
        eq(modelYearTerms.isActive, true)
      ))
      .orderBy(modelYearTerms.minModelYear);
  }

  async createModelYearTerm(term: InsertModelYearTerm): Promise<ModelYearTerm> {
    // Validate dealershipId is present before insert
    if (!term.dealershipId) {
      throw new Error('dealershipId is required when creating a model year term');
    }
    const result = await db.insert(modelYearTerms).values(term).returning();
    return result[0];
  }

  async updateModelYearTerm(id: number, dealershipId: number, term: Partial<InsertModelYearTerm>): Promise<ModelYearTerm | undefined> {
    // REQUIRED: Only update terms for this dealership
    const result = await db.update(modelYearTerms)
      .set({ ...term, updatedAt: new Date() })
      .where(and(
        eq(modelYearTerms.id, id),
        eq(modelYearTerms.dealershipId, dealershipId)
      ))
      .returning();
    return result[0];
  }

  async deleteModelYearTerm(id: number, dealershipId: number): Promise<boolean> {
    // REQUIRED: Soft delete only for this dealership
    await db.update(modelYearTerms)
      .set({ isActive: false })
      .where(and(
        eq(modelYearTerms.id, id),
        eq(modelYearTerms.dealershipId, dealershipId)
      ));
    return true;
  }

  async getAvailableTermsForYear(dealershipId: number, modelYear: number): Promise<string[]> {
    // REQUIRED: Only check terms for specific dealership
    const result = await db
      .select()
      .from(modelYearTerms)
      .where(
        and(
          eq(modelYearTerms.dealershipId, dealershipId),
          eq(modelYearTerms.isActive, true),
          lte(modelYearTerms.minModelYear, modelYear),
          gte(modelYearTerms.maxModelYear, modelYear)
        )
      )
      .limit(1);
    
    return result[0]?.availableTerms ?? ["36", "48", "60"]; // Default terms if no rule found
  }

  // ====== DEALERSHIP FEES (Multi-Tenant) ======
  async getDealershipFees(dealershipId: number): Promise<DealershipFee[]> {
    return await db.select().from(dealershipFees)
      .where(eq(dealershipFees.dealershipId, dealershipId))
      .orderBy(dealershipFees.displayOrder);
  }

  async createDealershipFee(fee: InsertDealershipFee): Promise<DealershipFee> {
    if (!fee.dealershipId) {
      throw new Error('dealershipId is required when creating a dealership fee');
    }
    const result = await db.insert(dealershipFees).values(fee).returning();
    return result[0];
  }

  async updateDealershipFee(id: number, dealershipId: number, fee: Partial<InsertDealershipFee>): Promise<DealershipFee | undefined> {
    const result = await db.update(dealershipFees)
      .set({ ...fee, updatedAt: new Date() })
      .where(and(
        eq(dealershipFees.id, id),
        eq(dealershipFees.dealershipId, dealershipId)
      ))
      .returning();
    return result[0];
  }

  async deleteDealershipFee(id: number, dealershipId: number): Promise<boolean> {
    await db.delete(dealershipFees)
      .where(and(
        eq(dealershipFees.id, id),
        eq(dealershipFees.dealershipId, dealershipId)
      ));
    return true;
  }

  async getActiveDealershipFees(dealershipId: number): Promise<DealershipFee[]> {
    return await db.select().from(dealershipFees)
      .where(and(
        eq(dealershipFees.dealershipId, dealershipId),
        eq(dealershipFees.isActive, true),
        eq(dealershipFees.includeInPayment, true)
      ))
      .orderBy(dealershipFees.displayOrder);
  }

  // ====== SCRAPE SOURCES (Multi-Tenant) ======
  async getScrapeSources(dealershipId: number): Promise<ScrapeSource[]> {
    return await db.select().from(scrapeSources)
      .where(eq(scrapeSources.dealershipId, dealershipId))
      .orderBy(scrapeSources.sourceName);
  }

  async createScrapeSource(source: InsertScrapeSource): Promise<ScrapeSource> {
    if (!source.dealershipId) {
      throw new Error('dealershipId is required when creating a scrape source');
    }
    const result = await db.insert(scrapeSources).values(source).returning();
    return result[0];
  }

  async updateScrapeSource(id: number, dealershipId: number, source: Partial<InsertScrapeSource>): Promise<ScrapeSource | undefined> {
    const result = await db.update(scrapeSources)
      .set({ ...source, updatedAt: new Date() })
      .where(and(
        eq(scrapeSources.id, id),
        eq(scrapeSources.dealershipId, dealershipId)
      ))
      .returning();
    return result[0];
  }

  async deleteScrapeSource(id: number, dealershipId: number): Promise<boolean> {
    await db.delete(scrapeSources)
      .where(and(
        eq(scrapeSources.id, id),
        eq(scrapeSources.dealershipId, dealershipId)
      ));
    return true;
  }

  async getActiveScrapeSources(dealershipId: number): Promise<ScrapeSource[]> {
    return await db.select().from(scrapeSources)
      .where(and(
        eq(scrapeSources.dealershipId, dealershipId),
        eq(scrapeSources.isActive, true)
      ))
      .orderBy(scrapeSources.sourceName);
  }

  async getAllActiveScrapeSources(): Promise<ScrapeSource[]> {
    return await db.select().from(scrapeSources)
      .where(eq(scrapeSources.isActive, true))
      .orderBy(scrapeSources.sourceName);
  }

  async getAllScrapeSources(): Promise<ScrapeSource[]> {
    return await db.select().from(scrapeSources)
      .orderBy(scrapeSources.sourceName);
  }

  async updateScrapeSourceAdmin(id: number, source: Partial<InsertScrapeSource>): Promise<ScrapeSource | undefined> {
    const result = await db.update(scrapeSources)
      .set({ ...source, updatedAt: new Date() })
      .where(eq(scrapeSources.id, id))
      .returning();
    return result[0];
  }

  async deleteScrapeSourceAdmin(id: number): Promise<boolean> {
    await db.delete(scrapeSources)
      .where(eq(scrapeSources.id, id));
    return true;
  }

  async updateScrapeSourceStats(id: number, vehicleCount: number): Promise<void> {
    await db.update(scrapeSources)
      .set({ 
        vehicleCount, 
        lastScrapedAt: new Date(),
        updatedAt: new Date() 
      })
      .where(eq(scrapeSources.id, id));
  }

  // ====== FACEBOOK ACCOUNTS (Multi-Tenant - Defense-in-Depth) ======
  async getFacebookAccountsByUser(userId: number, dealershipId: number): Promise<FacebookAccount[]> {
    // Defense-in-depth: Filter by both userId AND dealershipId
    return await db.select().from(facebookAccounts).where(and(
      eq(facebookAccounts.userId, userId),
      eq(facebookAccounts.dealershipId, dealershipId)
    ));
  }

  async getFacebookAccountById(id: number, userId: number, dealershipId: number): Promise<FacebookAccount | undefined> {
    // Defense-in-depth: Validate both userId AND dealershipId
    const result = await db.select().from(facebookAccounts).where(
      and(
        eq(facebookAccounts.id, id), 
        eq(facebookAccounts.userId, userId),
        eq(facebookAccounts.dealershipId, dealershipId)
      )
    ).limit(1);
    return result[0];
  }

  async createFacebookAccount(account: InsertFacebookAccount): Promise<FacebookAccount> {
    // Validate both userId and dealershipId are present
    if (!account.dealershipId) {
      throw new Error('dealershipId is required when creating a Facebook account');
    }
    const result = await db.insert(facebookAccounts).values(account).returning();
    return result[0];
  }

  async updateFacebookAccount(id: number, userId: number, dealershipId: number, account: Partial<InsertFacebookAccount>): Promise<FacebookAccount | undefined> {
    // Defense-in-depth: Validate both userId AND dealershipId
    const result = await db.update(facebookAccounts)
      .set({ ...account, updatedAt: new Date() })
      .where(and(
        eq(facebookAccounts.id, id), 
        eq(facebookAccounts.userId, userId),
        eq(facebookAccounts.dealershipId, dealershipId)
      ))
      .returning();
    return result[0];
  }

  async deleteFacebookAccount(id: number, userId: number, dealershipId: number): Promise<boolean> {
    // Defense-in-depth: Validate both userId AND dealershipId
    const result = await db.delete(facebookAccounts).where(and(
      eq(facebookAccounts.id, id), 
      eq(facebookAccounts.userId, userId),
      eq(facebookAccounts.dealershipId, dealershipId)
    )).returning();
    return result.length > 0;
  }

  async getAllFacebookAccountsByDealership(dealershipId: number): Promise<FacebookAccount[]> {
    // Get all Facebook accounts for a dealership (both user-scoped and dealership-level)
    return await db.select().from(facebookAccounts).where(
      eq(facebookAccounts.dealershipId, dealershipId)
    );
  }

  async updateFacebookAccountDirect(id: number, account: Partial<InsertFacebookAccount>): Promise<FacebookAccount | undefined> {
    // Direct update by ID only - used for system operations like token refresh
    const result = await db.update(facebookAccounts)
      .set({ ...account, updatedAt: new Date() })
      .where(eq(facebookAccounts.id, id))
      .returning();
    return result[0];
  }

  // ====== AD TEMPLATES (Multi-Tenant - Defense-in-Depth) ======
  async getAdTemplatesByUser(userId: number, dealershipId: number): Promise<AdTemplate[]> {
    // Defense-in-depth: Filter by both userId AND dealershipId
    return await db.select().from(adTemplates).where(and(
      eq(adTemplates.userId, userId),
      eq(adTemplates.dealershipId, dealershipId)
    ));
  }

  async getAdTemplateById(id: number, userId: number, dealershipId: number): Promise<AdTemplate | undefined> {
    // Defense-in-depth: Validate both userId AND dealershipId
    const result = await db.select().from(adTemplates).where(
      and(
        eq(adTemplates.id, id), 
        eq(adTemplates.userId, userId),
        eq(adTemplates.dealershipId, dealershipId)
      )
    ).limit(1);
    return result[0];
  }

  async createAdTemplate(template: InsertAdTemplate): Promise<AdTemplate> {
    // Validate both userId and dealershipId are present
    if (!template.dealershipId) {
      throw new Error('dealershipId is required when creating an ad template');
    }
    const result = await db.insert(adTemplates).values(template).returning();
    return result[0];
  }

  async updateAdTemplate(id: number, userId: number, dealershipId: number, template: Partial<InsertAdTemplate>): Promise<AdTemplate | undefined> {
    // Defense-in-depth: Validate both userId AND dealershipId
    const result = await db.update(adTemplates)
      .set({ ...template, updatedAt: new Date() })
      .where(and(
        eq(adTemplates.id, id), 
        eq(adTemplates.userId, userId),
        eq(adTemplates.dealershipId, dealershipId)
      ))
      .returning();
    return result[0];
  }

  async deleteAdTemplate(id: number, userId: number, dealershipId: number): Promise<boolean> {
    // Defense-in-depth: Validate both userId AND dealershipId
    const result = await db.delete(adTemplates).where(and(
      eq(adTemplates.id, id), 
      eq(adTemplates.userId, userId),
      eq(adTemplates.dealershipId, dealershipId)
    )).returning();
    return result.length > 0;
  }

  // ====== POSTING QUEUE (Multi-Tenant - Defense-in-Depth) ======
  async getPostingQueueByUser(userId: number, dealershipId: number): Promise<PostingQueue[]> {
    // Defense-in-depth: Filter by both userId AND dealershipId
    return await db.select().from(postingQueue)
      .where(and(
        eq(postingQueue.userId, userId),
        eq(postingQueue.dealershipId, dealershipId)
      ))
      .orderBy(postingQueue.queueOrder);
  }

  async getPostingQueueItem(id: number, dealershipId: number): Promise<PostingQueue | undefined> {
    // Filter by dealershipId for security
    const result = await db.select().from(postingQueue)
      .where(and(
        eq(postingQueue.id, id),
        eq(postingQueue.dealershipId, dealershipId)
      ))
      .limit(1);
    return result[0];
  }

  async createPostingQueueItem(item: InsertPostingQueue): Promise<PostingQueue> {
    // Validate both userId and dealershipId are present
    if (!item.dealershipId) {
      throw new Error('dealershipId is required when creating a posting queue item');
    }
    const result = await db.insert(postingQueue).values(item).returning();
    return result[0];
  }

  async updatePostingQueueItem(id: number, userId: number, dealershipId: number, item: Partial<InsertPostingQueue>): Promise<PostingQueue | undefined> {
    // Defense-in-depth: Validate both userId AND dealershipId
    const result = await db.update(postingQueue)
      .set({ ...item, updatedAt: new Date() })
      .where(and(
        eq(postingQueue.id, id), 
        eq(postingQueue.userId, userId),
        eq(postingQueue.dealershipId, dealershipId)
      ))
      .returning();
    return result[0];
  }

  async deletePostingQueueItem(id: number, userId: number, dealershipId: number): Promise<boolean> {
    // Defense-in-depth: Validate both userId AND dealershipId
    const result = await db.delete(postingQueue).where(and(
      eq(postingQueue.id, id), 
      eq(postingQueue.userId, userId),
      eq(postingQueue.dealershipId, dealershipId)
    )).returning();
    return result.length > 0;
  }

  async getNextQueuedPost(userId: number, dealershipId: number): Promise<PostingQueue | undefined> {
    // Defense-in-depth: Filter by both userId AND dealershipId
    const result = await db
      .select()
      .from(postingQueue)
      .where(
        and(
          eq(postingQueue.userId, userId),
          eq(postingQueue.dealershipId, dealershipId),
          eq(postingQueue.status, 'queued')
        )
      )
      .orderBy(postingQueue.queueOrder)
      .limit(1);
    
    return result[0];
  }

  // ====== POSTING SCHEDULE (Multi-Tenant - Defense-in-Depth) ======
  async getPostingScheduleByUser(userId: number, dealershipId: number): Promise<PostingSchedule | undefined> {
    // Defense-in-depth: Validate both userId AND dealershipId
    const result = await db.select().from(postingSchedule)
      .where(and(
        eq(postingSchedule.userId, userId),
        eq(postingSchedule.dealershipId, dealershipId)
      ))
      .limit(1);
    return result[0];
  }

  async getAllPostingSchedules(dealershipId: number): Promise<PostingSchedule[]> {
    // REQUIRED: Only return schedules for specific dealership
    return await db.select().from(postingSchedule)
      .where(eq(postingSchedule.dealershipId, dealershipId));
  }

  async createPostingSchedule(schedule: InsertPostingSchedule): Promise<PostingSchedule> {
    // Validate both userId and dealershipId are present
    if (!schedule.dealershipId) {
      throw new Error('dealershipId is required when creating a posting schedule');
    }
    const result = await db.insert(postingSchedule).values(schedule).returning();
    return result[0];
  }

  async updatePostingSchedule(userId: number, dealershipId: number, schedule: Partial<InsertPostingSchedule>): Promise<PostingSchedule | undefined> {
    // Defense-in-depth: Validate both userId AND dealershipId
    const result = await db.update(postingSchedule)
      .set({ ...schedule, updatedAt: new Date() })
      .where(and(
        eq(postingSchedule.userId, userId),
        eq(postingSchedule.dealershipId, dealershipId)
      ))
      .returning();
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

  // ====== PBS DMS INTEGRATION (Multi-Tenant) ======
  async getPbsConfig(dealershipId: number): Promise<PbsConfig | undefined> {
    // REQUIRED: Only return PBS config for specific dealership
    const result = await db
      .select()
      .from(pbsConfig)
      .where(and(
        eq(pbsConfig.dealershipId, dealershipId),
        eq(pbsConfig.isActive, true)
      ))
      .limit(1);
    return result[0];
  }

  async createPbsConfig(config: InsertPbsConfig): Promise<PbsConfig> {
    // Validate dealershipId is present before insert
    if (!config.dealershipId) {
      throw new Error('dealershipId is required when creating PBS config');
    }
    const result = await db.insert(pbsConfig).values(config).returning();
    return result[0];
  }

  async updatePbsConfig(id: number, dealershipId: number, config: Partial<InsertPbsConfig>): Promise<PbsConfig | undefined> {
    // REQUIRED: Only update PBS config for this dealership
    const result = await db
      .update(pbsConfig)
      .set({ ...config, updatedAt: new Date() })
      .where(and(
        eq(pbsConfig.id, id),
        eq(pbsConfig.dealershipId, dealershipId)
      ))
      .returning();
    return result[0];
  }

  async deletePbsConfig(id: number, dealershipId: number): Promise<boolean> {
    // REQUIRED: Only delete PBS config for this dealership
    await db.delete(pbsConfig).where(and(
      eq(pbsConfig.id, id),
      eq(pbsConfig.dealershipId, dealershipId)
    ));
    return true;
  }

  // ====== PBS WEBHOOK EVENTS (Multi-Tenant) ======
  async getPbsWebhookEvents(dealershipId: number, limit: number = 100): Promise<PbsWebhookEvent[]> {
    // REQUIRED: Only return webhook events for specific dealership
    return await db
      .select()
      .from(pbsWebhookEvents)
      .where(eq(pbsWebhookEvents.dealershipId, dealershipId))
      .orderBy(desc(pbsWebhookEvents.receivedAt))
      .limit(limit);
  }

  async getPbsWebhookEventById(id: number, dealershipId: number): Promise<PbsWebhookEvent | undefined> {
    // REQUIRED: Filter by dealership
    const result = await db
      .select()
      .from(pbsWebhookEvents)
      .where(and(
        eq(pbsWebhookEvents.id, id),
        eq(pbsWebhookEvents.dealershipId, dealershipId)
      ))
      .limit(1);
    return result[0];
  }

  async createPbsWebhookEvent(event: InsertPbsWebhookEvent): Promise<PbsWebhookEvent> {
    // Validate dealershipId is present before insert
    if (!event.dealershipId) {
      throw new Error('dealershipId is required when creating PBS webhook event');
    }
    const result = await db.insert(pbsWebhookEvents).values(event).returning();
    return result[0];
  }

  async updatePbsWebhookEvent(id: number, dealershipId: number, event: Partial<InsertPbsWebhookEvent>): Promise<PbsWebhookEvent | undefined> {
    // REQUIRED: Only update events for this dealership
    const result = await db
      .update(pbsWebhookEvents)
      .set(event)
      .where(and(
        eq(pbsWebhookEvents.id, id),
        eq(pbsWebhookEvents.dealershipId, dealershipId)
      ))
      .returning();
    return result[0];
  }

  // ====== PBS SESSIONS (Multi-Tenant) ======
  async getPbsSession(dealershipId: number): Promise<PbsSession | undefined> {
    // Get active, non-expired session for this dealership
    const result = await db
      .select()
      .from(pbsSessions)
      .where(and(
        eq(pbsSessions.dealershipId, dealershipId),
        eq(pbsSessions.isActive, true),
        gt(pbsSessions.expiresAt, new Date())
      ))
      .orderBy(desc(pbsSessions.lastUsedAt))
      .limit(1);
    return result[0];
  }

  async createPbsSession(session: InsertPbsSession): Promise<PbsSession> {
    if (!session.dealershipId) {
      throw new Error('dealershipId is required when creating PBS session');
    }
    const result = await db.insert(pbsSessions).values(session).returning();
    return result[0];
  }

  async updatePbsSessionLastUsed(id: number, dealershipId: number): Promise<void> {
    await db
      .update(pbsSessions)
      .set({ lastUsedAt: new Date() })
      .where(and(
        eq(pbsSessions.id, id),
        eq(pbsSessions.dealershipId, dealershipId)
      ));
  }

  async deletePbsSession(id: number, dealershipId: number): Promise<boolean> {
    const result = await db
      .delete(pbsSessions)
      .where(and(
        eq(pbsSessions.id, id),
        eq(pbsSessions.dealershipId, dealershipId)
      ))
      .returning();
    return result.length > 0;
  }

  async deleteExpiredPbsSessions(dealershipId: number): Promise<number> {
    const result = await db
      .delete(pbsSessions)
      .where(and(
        eq(pbsSessions.dealershipId, dealershipId),
        lt(pbsSessions.expiresAt, new Date())
      ))
      .returning();
    return result.length;
  }

  // ====== PBS CONTACT CACHE (Multi-Tenant) ======
  async getPbsContactByPbsId(dealershipId: number, pbsContactId: string): Promise<PbsContactCache | undefined> {
    const result = await db
      .select()
      .from(pbsContactCache)
      .where(and(
        eq(pbsContactCache.dealershipId, dealershipId),
        eq(pbsContactCache.pbsContactId, pbsContactId),
        gt(pbsContactCache.expiresAt, new Date())
      ))
      .limit(1);
    return result[0];
  }

  async getPbsContactByPhone(dealershipId: number, phone: string): Promise<PbsContactCache | undefined> {
    // Normalize phone number for lookup
    const normalizedPhone = phone.replace(/\D/g, '');
    const result = await db
      .select()
      .from(pbsContactCache)
      .where(and(
        eq(pbsContactCache.dealershipId, dealershipId),
        gt(pbsContactCache.expiresAt, new Date())
      ))
      .limit(100);
    
    // Check if any cached contact's phone matches (normalized)
    return result.find(c => 
      (c.phone?.replace(/\D/g, '') === normalizedPhone) ||
      (c.cellPhone?.replace(/\D/g, '') === normalizedPhone)
    );
  }

  async getPbsContactByEmail(dealershipId: number, email: string): Promise<PbsContactCache | undefined> {
    const result = await db
      .select()
      .from(pbsContactCache)
      .where(and(
        eq(pbsContactCache.dealershipId, dealershipId),
        eq(pbsContactCache.email, email.toLowerCase()),
        gt(pbsContactCache.expiresAt, new Date())
      ))
      .limit(1);
    return result[0];
  }

  async createPbsContactCache(contact: InsertPbsContactCache): Promise<PbsContactCache> {
    if (!contact.dealershipId) {
      throw new Error('dealershipId is required when caching PBS contact');
    }
    const result = await db.insert(pbsContactCache).values({
      ...contact,
      email: contact.email?.toLowerCase()
    }).returning();
    return result[0];
  }

  async updatePbsContactCache(id: number, dealershipId: number, contact: Partial<InsertPbsContactCache>): Promise<PbsContactCache | undefined> {
    const result = await db
      .update(pbsContactCache)
      .set({
        ...contact,
        email: contact.email?.toLowerCase(),
        fetchedAt: new Date()
      })
      .where(and(
        eq(pbsContactCache.id, id),
        eq(pbsContactCache.dealershipId, dealershipId)
      ))
      .returning();
    return result[0];
  }

  async deleteExpiredPbsContactCache(dealershipId: number): Promise<number> {
    const result = await db
      .delete(pbsContactCache)
      .where(and(
        eq(pbsContactCache.dealershipId, dealershipId),
        lt(pbsContactCache.expiresAt, new Date())
      ))
      .returning();
    return result.length;
  }

  // ====== PBS APPOINTMENT CACHE (Multi-Tenant) ======
  async getPbsAppointmentByPbsId(dealershipId: number, pbsAppointmentId: string): Promise<PbsAppointmentCache | undefined> {
    const result = await db
      .select()
      .from(pbsAppointmentCache)
      .where(and(
        eq(pbsAppointmentCache.dealershipId, dealershipId),
        eq(pbsAppointmentCache.pbsAppointmentId, pbsAppointmentId),
        gt(pbsAppointmentCache.expiresAt, new Date())
      ))
      .limit(1);
    return result[0];
  }

  async getPbsAppointmentsByContact(dealershipId: number, pbsContactId: string): Promise<PbsAppointmentCache[]> {
    return await db
      .select()
      .from(pbsAppointmentCache)
      .where(and(
        eq(pbsAppointmentCache.dealershipId, dealershipId),
        eq(pbsAppointmentCache.pbsContactId, pbsContactId),
        gt(pbsAppointmentCache.expiresAt, new Date())
      ))
      .orderBy(desc(pbsAppointmentCache.scheduledDate));
  }

  async createPbsAppointmentCache(appointment: InsertPbsAppointmentCache): Promise<PbsAppointmentCache> {
    if (!appointment.dealershipId) {
      throw new Error('dealershipId is required when caching PBS appointment');
    }
    const result = await db.insert(pbsAppointmentCache).values(appointment).returning();
    return result[0];
  }

  async updatePbsAppointmentCache(id: number, dealershipId: number, appointment: Partial<InsertPbsAppointmentCache>): Promise<PbsAppointmentCache | undefined> {
    const result = await db
      .update(pbsAppointmentCache)
      .set({
        ...appointment,
        fetchedAt: new Date()
      })
      .where(and(
        eq(pbsAppointmentCache.id, id),
        eq(pbsAppointmentCache.dealershipId, dealershipId)
      ))
      .returning();
    return result[0];
  }

  async deleteExpiredPbsAppointmentCache(dealershipId: number): Promise<number> {
    const result = await db
      .delete(pbsAppointmentCache)
      .where(and(
        eq(pbsAppointmentCache.dealershipId, dealershipId),
        lt(pbsAppointmentCache.expiresAt, new Date())
      ))
      .returning();
    return result.length;
  }

  // ====== PBS PARTS CACHE (Multi-Tenant) ======
  async getPbsPartByNumber(dealershipId: number, partNumber: string): Promise<PbsPartsCache | undefined> {
    const result = await db
      .select()
      .from(pbsPartsCache)
      .where(and(
        eq(pbsPartsCache.dealershipId, dealershipId),
        eq(pbsPartsCache.partNumber, partNumber.toUpperCase()),
        gt(pbsPartsCache.expiresAt, new Date())
      ))
      .limit(1);
    return result[0];
  }

  async searchPbsParts(dealershipId: number, query: string): Promise<PbsPartsCache[]> {
    const searchPattern = `%${query.toUpperCase()}%`;
    return await db
      .select()
      .from(pbsPartsCache)
      .where(and(
        eq(pbsPartsCache.dealershipId, dealershipId),
        gt(pbsPartsCache.expiresAt, new Date()),
        or(
          ilike(pbsPartsCache.partNumber, searchPattern),
          ilike(pbsPartsCache.description, searchPattern)
        )
      ))
      .limit(50);
  }

  async createPbsPartsCache(part: InsertPbsPartsCache): Promise<PbsPartsCache> {
    if (!part.dealershipId) {
      throw new Error('dealershipId is required when caching PBS part');
    }
    const result = await db.insert(pbsPartsCache).values({
      ...part,
      partNumber: part.partNumber.toUpperCase()
    }).returning();
    return result[0];
  }

  async updatePbsPartsCache(id: number, dealershipId: number, part: Partial<InsertPbsPartsCache>): Promise<PbsPartsCache | undefined> {
    const result = await db
      .update(pbsPartsCache)
      .set({
        ...part,
        partNumber: part.partNumber?.toUpperCase(),
        fetchedAt: new Date()
      })
      .where(and(
        eq(pbsPartsCache.id, id),
        eq(pbsPartsCache.dealershipId, dealershipId)
      ))
      .returning();
    return result[0];
  }

  async deleteExpiredPbsPartsCache(dealershipId: number): Promise<number> {
    const result = await db
      .delete(pbsPartsCache)
      .where(and(
        eq(pbsPartsCache.dealershipId, dealershipId),
        lt(pbsPartsCache.expiresAt, new Date())
      ))
      .returning();
    return result.length;
  }

  // ====== PBS API LOGS (Multi-Tenant) ======
  async createPbsApiLog(log: InsertPbsApiLog): Promise<PbsApiLog> {
    if (!log.dealershipId) {
      throw new Error('dealershipId is required when creating PBS API log');
    }
    const result = await db.insert(pbsApiLogs).values(log).returning();
    return result[0];
  }

  async getPbsApiLogs(dealershipId: number, limit: number = 100): Promise<PbsApiLog[]> {
    return await db
      .select()
      .from(pbsApiLogs)
      .where(eq(pbsApiLogs.dealershipId, dealershipId))
      .orderBy(desc(pbsApiLogs.createdAt))
      .limit(limit);
  }

  // ====== GOHIGHLEVEL ACCOUNTS (Multi-Tenant) ======
  async getGhlAccountByDealership(dealershipId: number): Promise<GhlAccount | undefined> {
    const result = await db
      .select()
      .from(ghlAccounts)
      .where(and(
        eq(ghlAccounts.dealershipId, dealershipId),
        eq(ghlAccounts.isActive, true)
      ))
      .orderBy(desc(ghlAccounts.createdAt))
      .limit(1);
    return result[0];
  }

  async getGhlAccountById(id: number, dealershipId: number): Promise<GhlAccount | undefined> {
    const result = await db
      .select()
      .from(ghlAccounts)
      .where(and(
        eq(ghlAccounts.id, id),
        eq(ghlAccounts.dealershipId, dealershipId)
      ))
      .limit(1);
    return result[0];
  }

  async createGhlAccount(account: InsertGhlAccount): Promise<GhlAccount> {
    if (!account.dealershipId) {
      throw new Error('dealershipId is required when creating GHL account');
    }
    // Deactivate any existing accounts for this dealership
    await db
      .update(ghlAccounts)
      .set({ isActive: false })
      .where(eq(ghlAccounts.dealershipId, account.dealershipId));
    
    const result = await db.insert(ghlAccounts).values(account).returning();
    return result[0];
  }

  async updateGhlAccount(id: number, dealershipId: number, updates: Partial<InsertGhlAccount>): Promise<GhlAccount | undefined> {
    const result = await db
      .update(ghlAccounts)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(
        eq(ghlAccounts.id, id),
        eq(ghlAccounts.dealershipId, dealershipId)
      ))
      .returning();
    return result[0];
  }

  async deleteGhlAccount(id: number, dealershipId: number): Promise<boolean> {
    const result = await db
      .delete(ghlAccounts)
      .where(and(
        eq(ghlAccounts.id, id),
        eq(ghlAccounts.dealershipId, dealershipId)
      ))
      .returning();
    return result.length > 0;
  }

  // ====== GOHIGHLEVEL CONFIG (Multi-Tenant) ======
  async getGhlConfig(dealershipId: number): Promise<GhlConfig | undefined> {
    const result = await db
      .select()
      .from(ghlConfig)
      .where(eq(ghlConfig.dealershipId, dealershipId))
      .limit(1);
    return result[0];
  }

  async createGhlConfig(config: InsertGhlConfig): Promise<GhlConfig> {
    if (!config.dealershipId) {
      throw new Error('dealershipId is required when creating GHL config');
    }
    const result = await db.insert(ghlConfig).values(config).returning();
    return result[0];
  }

  async updateGhlConfig(id: number, dealershipId: number, updates: Partial<InsertGhlConfig>): Promise<GhlConfig | undefined> {
    const result = await db
      .update(ghlConfig)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(
        eq(ghlConfig.id, id),
        eq(ghlConfig.dealershipId, dealershipId)
      ))
      .returning();
    return result[0];
  }

  // ====== GOHIGHLEVEL WEBHOOK EVENTS (Multi-Tenant) ======
  async createGhlWebhookEvent(event: InsertGhlWebhookEvent): Promise<GhlWebhookEvent> {
    if (!event.dealershipId) {
      throw new Error('dealershipId is required when creating GHL webhook event');
    }
    const result = await db.insert(ghlWebhookEvents).values(event).returning();
    return result[0];
  }

  async getGhlWebhookEvents(dealershipId: number, status?: string, limit: number = 100): Promise<GhlWebhookEvent[]> {
    const conditions = [eq(ghlWebhookEvents.dealershipId, dealershipId)];
    if (status) {
      conditions.push(eq(ghlWebhookEvents.status, status));
    }
    
    return await db
      .select()
      .from(ghlWebhookEvents)
      .where(and(...conditions))
      .orderBy(desc(ghlWebhookEvents.receivedAt))
      .limit(limit);
  }

  async updateGhlWebhookEvent(id: number, dealershipId: number, updates: Partial<InsertGhlWebhookEvent>): Promise<GhlWebhookEvent | undefined> {
    const result = await db
      .update(ghlWebhookEvents)
      .set(updates)
      .where(and(
        eq(ghlWebhookEvents.id, id),
        eq(ghlWebhookEvents.dealershipId, dealershipId)
      ))
      .returning();
    return result[0];
  }

  async getGhlWebhookEventByEventId(dealershipId: number, eventId: string): Promise<GhlWebhookEvent | undefined> {
    const result = await db
      .select()
      .from(ghlWebhookEvents)
      .where(and(
        eq(ghlWebhookEvents.dealershipId, dealershipId),
        eq(ghlWebhookEvents.eventId, eventId)
      ))
      .limit(1);
    return result[0];
  }

  // ====== GOHIGHLEVEL CONTACT SYNC (Multi-Tenant) ======
  async getGhlContactSync(dealershipId: number, ghlContactId: string): Promise<GhlContactSync | undefined> {
    const result = await db
      .select()
      .from(ghlContactSync)
      .where(and(
        eq(ghlContactSync.dealershipId, dealershipId),
        eq(ghlContactSync.ghlContactId, ghlContactId)
      ))
      .limit(1);
    return result[0];
  }

  async getGhlContactSyncByPbsId(dealershipId: number, pbsContactId: string): Promise<GhlContactSync | undefined> {
    const result = await db
      .select()
      .from(ghlContactSync)
      .where(and(
        eq(ghlContactSync.dealershipId, dealershipId),
        eq(ghlContactSync.pbsContactId, pbsContactId)
      ))
      .limit(1);
    return result[0];
  }

  async createGhlContactSync(sync: InsertGhlContactSync): Promise<GhlContactSync> {
    if (!sync.dealershipId) {
      throw new Error('dealershipId is required when creating GHL contact sync');
    }
    const result = await db.insert(ghlContactSync).values(sync).returning();
    return result[0];
  }

  async updateGhlContactSync(id: number, dealershipId: number, updates: Partial<InsertGhlContactSync>): Promise<GhlContactSync | undefined> {
    const result = await db
      .update(ghlContactSync)
      .set({ ...updates, lastSyncAt: new Date() })
      .where(and(
        eq(ghlContactSync.id, id),
        eq(ghlContactSync.dealershipId, dealershipId)
      ))
      .returning();
    return result[0];
  }

  async getPendingGhlContactSyncs(dealershipId: number, limit: number = 100): Promise<GhlContactSync[]> {
    return await db
      .select()
      .from(ghlContactSync)
      .where(and(
        eq(ghlContactSync.dealershipId, dealershipId),
        eq(ghlContactSync.syncStatus, 'pending')
      ))
      .orderBy(ghlContactSync.createdAt)
      .limit(limit);
  }

  // ====== GOHIGHLEVEL APPOINTMENT SYNC (Multi-Tenant) ======
  async getGhlAppointmentSync(dealershipId: number, ghlAppointmentId: string): Promise<GhlAppointmentSync | undefined> {
    const result = await db
      .select()
      .from(ghlAppointmentSync)
      .where(and(
        eq(ghlAppointmentSync.dealershipId, dealershipId),
        eq(ghlAppointmentSync.ghlAppointmentId, ghlAppointmentId)
      ))
      .limit(1);
    return result[0];
  }

  async createGhlAppointmentSync(sync: InsertGhlAppointmentSync): Promise<GhlAppointmentSync> {
    if (!sync.dealershipId) {
      throw new Error('dealershipId is required when creating GHL appointment sync');
    }
    const result = await db.insert(ghlAppointmentSync).values(sync).returning();
    return result[0];
  }

  async updateGhlAppointmentSync(id: number, dealershipId: number, updates: Partial<InsertGhlAppointmentSync>): Promise<GhlAppointmentSync | undefined> {
    const result = await db
      .update(ghlAppointmentSync)
      .set({ ...updates, lastSyncAt: new Date() })
      .where(and(
        eq(ghlAppointmentSync.id, id),
        eq(ghlAppointmentSync.dealershipId, dealershipId)
      ))
      .returning();
    return result[0];
  }

  async getPendingGhlAppointmentSyncs(dealershipId: number, limit: number = 100): Promise<GhlAppointmentSync[]> {
    return await db
      .select()
      .from(ghlAppointmentSync)
      .where(and(
        eq(ghlAppointmentSync.dealershipId, dealershipId),
        eq(ghlAppointmentSync.syncStatus, 'pending')
      ))
      .orderBy(ghlAppointmentSync.createdAt)
      .limit(limit);
  }

  // ====== GOHIGHLEVEL API LOGS (Multi-Tenant) ======
  async createGhlApiLog(log: InsertGhlApiLog): Promise<GhlApiLog> {
    if (!log.dealershipId) {
      throw new Error('dealershipId is required when creating GHL API log');
    }
    const result = await db.insert(ghlApiLogs).values(log).returning();
    return result[0];
  }

  async getGhlApiLogs(dealershipId: number, limit: number = 100): Promise<GhlApiLog[]> {
    return await db
      .select()
      .from(ghlApiLogs)
      .where(eq(ghlApiLogs.dealershipId, dealershipId))
      .orderBy(desc(ghlApiLogs.createdAt))
      .limit(limit);
  }

  // ====== MANAGER SETTINGS (Multi-Tenant via User) ======
  async getManagerSettings(userId: number, dealershipId: number): Promise<ManagerSettings | undefined> {
    // Multi-tenant through user - verify user belongs to dealership first, then get settings
    const user = await this.getUserById(userId, dealershipId);
    if (!user) {
      return undefined; // User doesn't belong to this dealership
    }
    
    const result = await db
      .select()
      .from(managerSettings)
      .where(eq(managerSettings.userId, userId))
      .limit(1);
    return result[0];
  }

  async getManagerSettingsByDealership(dealershipId: number): Promise<ManagerSettings | undefined> {
    // Get any manager settings for this dealership (used for scheduled jobs)
    // Join with users to filter by dealership
    const result = await db
      .select({ settings: managerSettings })
      .from(managerSettings)
      .innerJoin(users, eq(users.id, managerSettings.userId))
      .where(eq(users.dealershipId, dealershipId))
      .limit(1);
    return result[0]?.settings;
  }

  async createManagerSettings(settings: InsertManagerSettings): Promise<ManagerSettings> {
    const result = await db.insert(managerSettings).values(settings).returning();
    return result[0];
  }

  async updateManagerSettings(userId: number, dealershipId: number, settings: Partial<InsertManagerSettings>): Promise<ManagerSettings | undefined> {
    // Multi-tenant through user - verify user belongs to dealership first
    const user = await this.getUserById(userId, dealershipId);
    if (!user) {
      return undefined; // User doesn't belong to this dealership
    }
    
    const result = await db
      .update(managerSettings)
      .set({ ...settings, updatedAt: new Date() })
      .where(eq(managerSettings.userId, userId))
      .returning();
    return result[0];
  }

  // ====== MARKET LISTINGS (Multi-Tenant) ======
  async getMarketListings(dealershipId: number, filters: { make?: string; model?: string; yearMin?: number; yearMax?: number; source?: string }, limit: number = 50, offset: number = 0): Promise<{ listings: MarketListing[]; total: number }> {
    const conditions = [];
    
    // REQUIRED: Always filter by dealership
    conditions.push(eq(marketListings.dealershipId, dealershipId));
    
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
    
    const whereClause = and(...conditions);
    
    // Get total count
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(marketListings)
      .where(whereClause);
    
    // Get paginated listings
    const listings = await db
      .select()
      .from(marketListings)
      .where(whereClause)
      .orderBy(desc(marketListings.scrapedAt))
      .limit(limit)
      .offset(offset);
    
    return {
      listings,
      total: count
    };
  }

  async getMarketListingById(id: number, dealershipId: number): Promise<MarketListing | undefined> {
    // REQUIRED: Filter by dealership
    const result = await db
      .select()
      .from(marketListings)
      .where(and(
        eq(marketListings.id, id),
        eq(marketListings.dealershipId, dealershipId)
      ))
      .limit(1);
    return result[0];
  }

  async getMarketListingsByUrls(dealershipId: number, urls: string[]): Promise<MarketListing[]> {
    if (urls.length === 0) {
      return [];
    }
    
    // Filter out any empty or invalid URLs
    const validUrls = urls.filter(url => url && typeof url === 'string' && url.length > 0);
    if (validUrls.length === 0) {
      return [];
    }
    
    // REQUIRED: Filter by dealership
    // Use proper PostgreSQL array syntax
    const result = await db
      .select()
      .from(marketListings)
      .where(and(
        eq(marketListings.dealershipId, dealershipId),
        inArray(marketListings.listingUrl, validUrls)
      ));
    return result;
  }

  async createMarketListing(listing: InsertMarketListing): Promise<MarketListing> {
    // Validate dealershipId is present before insert
    if (!listing.dealershipId) {
      throw new Error('dealershipId is required when creating a market listing');
    }
    const result = await db.insert(marketListings).values(listing).returning();
    return result[0];
  }

  async updateMarketListing(id: number, dealershipId: number, listing: Partial<InsertMarketListing>): Promise<MarketListing | undefined> {
    // REQUIRED: Only update listings for this dealership
    const result = await db
      .update(marketListings)
      .set(listing)
      .where(and(
        eq(marketListings.id, id),
        eq(marketListings.dealershipId, dealershipId)
      ))
      .returning();
    return result[0];
  }

  async deactivateMarketListing(dealershipId: number, url: string): Promise<boolean> {
    // REQUIRED: Only deactivate listings for this dealership
    await db
      .update(marketListings)
      .set({ isActive: false })
      .where(and(
        eq(marketListings.listingUrl, url),
        eq(marketListings.dealershipId, dealershipId)
      ));
    return true;
  }

  async deleteOldMarketListings(dealershipId: number, daysOld: number): Promise<number> {
    // REQUIRED: Only delete old listings for this dealership
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    await db
      .delete(marketListings)
      .where(and(
        eq(marketListings.dealershipId, dealershipId),
        lte(marketListings.scrapedAt, cutoffDate)
      ));
    
    return 0; // Drizzle doesn't return count for deletes
  }

  // ====== SUPER ADMIN - GLOBAL SETTINGS ======
  async getGlobalSetting(key: string): Promise<GlobalSetting | undefined> {
    const result = await db.select().from(globalSettings).where(eq(globalSettings.key, key)).limit(1);
    return result[0];
  }

  async getAllGlobalSettings(): Promise<GlobalSetting[]> {
    return await db.select().from(globalSettings).orderBy(globalSettings.key);
  }

  async setGlobalSetting(setting: InsertGlobalSetting): Promise<GlobalSetting> {
    const result = await db
      .insert(globalSettings)
      .values(setting)
      .onConflictDoUpdate({
        target: globalSettings.key,
        set: {
          value: setting.value,
          updatedAt: new Date(),
        },
      })
      .returning();
    return result[0];
  }

  async deleteGlobalSetting(key: string): Promise<boolean> {
    await db.delete(globalSettings).where(eq(globalSettings.key, key));
    return true;
  }

  // ====== SUPER ADMIN - AUDIT LOGGING ======
  async logAuditAction(log: InsertAuditLog): Promise<AuditLog> {
    const result = await db.insert(auditLogs).values(log).returning();
    return result[0];
  }

  async getAuditLogs(limit: number = 50, offset: number = 0): Promise<{ logs: AuditLog[]; total: number }> {
    // Get total count
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(auditLogs);
    
    // Get paginated logs, ordered by createdAt DESC
    const logs = await db
      .select()
      .from(auditLogs)
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset(offset);
    
    return {
      logs,
      total: count
    };
  }

  // ====== SUPER ADMIN - DEALERSHIP PROVISIONING ======
  async createDealershipWithSetup(params: {
    name: string;
    slug: string;
    subdomain: string;
    address?: string;
    city?: string;
    province?: string;
    postalCode?: string;
    phone?: string;
    timezone?: string;
    defaultCurrency?: string;
    masterAdminEmail: string;
    masterAdminName: string;
    masterAdminPassword: string;
    // API Keys (optional)
    openaiApiKey?: string;
    marketcheckKey?: string;
    apifyToken?: string;
    apifyActorId?: string;
    geminiApiKey?: string;
    ghlApiKey?: string;
    ghlLocationId?: string;
    facebookAppId?: string;
    facebookAppSecret?: string;
  }): Promise<{ dealership: Dealership; masterAdmin: User }> {
    return await db.transaction(async (tx) => {
      // a) Create dealership
      const [dealership] = await tx
        .insert(dealerships)
        .values({
          name: params.name,
          slug: params.slug,
          subdomain: params.subdomain,
          address: params.address,
          city: params.city,
          province: params.province,
          postalCode: params.postalCode,
          phone: params.phone,
          timezone: params.timezone || 'America/Vancouver',
          defaultCurrency: params.defaultCurrency || 'CAD',
          isActive: true,
        })
        .returning();

      // b) Create master admin user with hashed password
      const passwordHash = await hashPassword(params.masterAdminPassword);
      const [masterAdmin] = await tx
        .insert(users)
        .values({
          dealershipId: dealership.id,
          email: params.masterAdminEmail,
          passwordHash: passwordHash,
          name: params.masterAdminName,
          role: 'master',
          isActive: true,
          createdBy: null,
        })
        .returning();

      // c) Create 5 credit score tiers
      const creditTiers = [
        {
          dealershipId: dealership.id,
          tierName: "Excellent",
          minScore: 750,
          maxScore: 850,
          interestRate: 399,
          isActive: true,
        },
        {
          dealershipId: dealership.id,
          tierName: "Very Good",
          minScore: 700,
          maxScore: 749,
          interestRate: 499,
          isActive: true,
        },
        {
          dealershipId: dealership.id,
          tierName: "Good",
          minScore: 650,
          maxScore: 699,
          interestRate: 699,
          isActive: true,
        },
        {
          dealershipId: dealership.id,
          tierName: "Fair",
          minScore: 600,
          maxScore: 649,
          interestRate: 999,
          isActive: true,
        },
        {
          dealershipId: dealership.id,
          tierName: "Poor",
          minScore: 300,
          maxScore: 599,
          interestRate: 1499,
          isActive: true,
        },
      ];
      await tx.insert(creditScoreTiers).values(creditTiers);

      // d) Create 4 model year financing terms
      const currentYear = new Date().getFullYear();
      const yearTerms = [
        {
          dealershipId: dealership.id,
          minModelYear: currentYear,
          maxModelYear: currentYear + 1,
          availableTerms: ["24", "36", "48", "60", "72", "84"],
          isActive: true,
        },
        {
          dealershipId: dealership.id,
          minModelYear: currentYear - 3,
          maxModelYear: currentYear - 1,
          availableTerms: ["24", "36", "48", "60", "72"],
          isActive: true,
        },
        {
          dealershipId: dealership.id,
          minModelYear: currentYear - 7,
          maxModelYear: currentYear - 4,
          availableTerms: ["24", "36", "48", "60"],
          isActive: true,
        },
        {
          dealershipId: dealership.id,
          minModelYear: 2010,
          maxModelYear: currentYear - 8,
          availableTerms: ["24", "36", "48"],
          isActive: true,
        },
      ];
      await tx.insert(modelYearTerms).values(yearTerms);

      // e) Create 5 chat prompts
      const chatPromptData = [
        {
          dealershipId: dealership.id,
          name: "Test Drive Scheduling",
          scenario: "test-drive",
          systemPrompt: `You are a helpful assistant for ${params.name}. Help customers schedule test drives. Be friendly, professional, and gather: preferred date/time, contact information, and which vehicle they're interested in. If they have questions about the vehicle, answer them enthusiastically.`,
          greeting: `Hi! I'd love to help you schedule a test drive at ${params.name}. Which vehicle are you interested in?`,
          isActive: true,
        },
        {
          dealershipId: dealership.id,
          name: "Financing Pre-Approval",
          scenario: "get-approved",
          systemPrompt: `You are a financing specialist for ${params.name}. Help customers understand their financing options and pre-approval process. Gather: employment status, credit score range, down payment amount, and monthly budget. Explain the benefits of getting pre-approved and how it speeds up the buying process.`,
          greeting: `Welcome to ${params.name}! Let's explore your financing options. Getting pre-approved is quick and won't affect your credit score. What vehicle are you interested in financing?`,
          isActive: true,
        },
        {
          dealershipId: dealership.id,
          name: "Trade-In Valuation",
          scenario: "value-trade",
          systemPrompt: `You are a trade-in specialist for ${params.name}. Help customers get a trade-in valuation for their current vehicle. Gather: year, make, model, trim, odometer reading, condition, and any issues. Explain that we offer competitive trade-in values and can provide an instant estimate.`,
          greeting: `Hi! I can help you get a trade-in value for your current vehicle. What are you driving right now?`,
          isActive: true,
        },
        {
          dealershipId: dealership.id,
          name: "Vehicle Reservation",
          scenario: "reserve",
          systemPrompt: `You are a reservation specialist for ${params.name}. Help customers reserve vehicles with a refundable deposit. Gather: which vehicle they want to reserve, contact information, and preferred payment method. Explain that reservations are fully refundable and hold the vehicle for 48 hours.`,
          greeting: `Great choice! I can help you reserve this vehicle. Reservations are fully refundable and hold the vehicle for 48 hours. Let me get a few details from you.`,
          isActive: true,
        },
        {
          dealershipId: dealership.id,
          name: "General Assistance",
          scenario: "general",
          systemPrompt: `You are a knowledgeable sales assistant for ${params.name}. Answer questions about vehicles, inventory, features, pricing, and dealership services. Be helpful, enthusiastic, and guide customers toward booking a test drive or speaking with a sales specialist for specific pricing questions.`,
          greeting: `Welcome to ${params.name}! How can I help you today? Are you looking for something specific or would you like to browse our inventory?`,
          isActive: true,
        },
      ];
      await tx.insert(chatPrompts).values(chatPromptData);

      // f) Create API keys entry if any keys are provided
      const hasApiKeys = params.openaiApiKey || params.marketcheckKey || params.apifyToken || 
                        params.apifyActorId || params.geminiApiKey || params.ghlApiKey || 
                        params.ghlLocationId || params.facebookAppId || params.facebookAppSecret;
      
      if (hasApiKeys) {
        await tx.insert(dealershipApiKeys).values({
          dealershipId: dealership.id,
          openaiApiKey: params.openaiApiKey || null,
          marketcheckKey: params.marketcheckKey || null,
          apifyToken: params.apifyToken || null,
          apifyActorId: params.apifyActorId || null,
          geminiApiKey: params.geminiApiKey || null,
          ghlApiKey: params.ghlApiKey || null,
          ghlLocationId: params.ghlLocationId || null,
          facebookAppId: params.facebookAppId || null,
          facebookAppSecret: params.facebookAppSecret || null,
        });
      }

      // g) Return created dealership and master admin
      return { dealership, masterAdmin };
    });
  }

  // ====== EXTERNAL API TOKENS (Multi-Tenant) ======
  async getExternalApiTokens(dealershipId: number): Promise<ExternalApiToken[]> {
    return await db.select().from(externalApiTokens)
      .where(eq(externalApiTokens.dealershipId, dealershipId))
      .orderBy(desc(externalApiTokens.createdAt));
  }

  async getExternalApiTokenById(id: number, dealershipId: number): Promise<ExternalApiToken | undefined> {
    const result = await db.select().from(externalApiTokens)
      .where(and(
        eq(externalApiTokens.id, id),
        eq(externalApiTokens.dealershipId, dealershipId)
      ))
      .limit(1);
    return result[0];
  }

  async getExternalApiTokenByPrefix(prefix: string): Promise<ExternalApiToken | undefined> {
    const result = await db.select().from(externalApiTokens)
      .where(eq(externalApiTokens.tokenPrefix, prefix))
      .limit(1);
    return result[0];
  }

  async createExternalApiToken(token: InsertExternalApiToken): Promise<ExternalApiToken> {
    const result = await db.insert(externalApiTokens).values(token).returning();
    return result[0];
  }

  async updateExternalApiToken(id: number, dealershipId: number, token: Partial<InsertExternalApiToken>): Promise<ExternalApiToken | undefined> {
    const result = await db.update(externalApiTokens)
      .set(token)
      .where(and(
        eq(externalApiTokens.id, id),
        eq(externalApiTokens.dealershipId, dealershipId)
      ))
      .returning();
    return result[0];
  }

  async deleteExternalApiToken(id: number, dealershipId: number): Promise<boolean> {
    // Always require dealershipId match for security - prevents cross-tenant deletion
    const result = await db.delete(externalApiTokens)
      .where(and(
        eq(externalApiTokens.id, id),
        eq(externalApiTokens.dealershipId, dealershipId)
      ))
      .returning();
    return result.length > 0;
  }

  async updateExternalApiTokenLastUsed(id: number): Promise<void> {
    await db.update(externalApiTokens)
      .set({ lastUsedAt: new Date() })
      .where(eq(externalApiTokens.id, id));
  }
  
  // ====== STAFF INVITES ======
  async getStaffInviteByToken(token: string): Promise<StaffInvite | undefined> {
    const result = await db.select().from(staffInvites)
      .where(eq(staffInvites.inviteToken, token))
      .limit(1);
    return result[0];
  }
  
  async acceptStaffInvite(id: number): Promise<void> {
    await db.update(staffInvites)
      .set({ 
        status: 'accepted',
        acceptedAt: new Date(),
      })
      .where(eq(staffInvites.id, id));
  }
  
  async getDealershipById(id: number): Promise<Dealership | undefined> {
    const result = await db.select().from(dealerships)
      .where(eq(dealerships.id, id))
      .limit(1);
    return result[0];
  }
  
  // ====== LAUNCH CHECKLIST ======
  async getLaunchChecklist(dealershipId: number): Promise<LaunchChecklist[]> {
    return await db.select().from(launchChecklist)
      .where(eq(launchChecklist.dealershipId, dealershipId))
      .orderBy(launchChecklist.category, launchChecklist.sortOrder);
  }
  
  async getLaunchChecklistByCategory(dealershipId: number, category: string): Promise<LaunchChecklist[]> {
    return await db.select().from(launchChecklist)
      .where(and(
        eq(launchChecklist.dealershipId, dealershipId),
        eq(launchChecklist.category, category)
      ))
      .orderBy(launchChecklist.sortOrder);
  }
  
  async getLaunchChecklistProgress(dealershipId: number): Promise<{ total: number; completed: number; required: number; requiredCompleted: number }> {
    const items = await db.select().from(launchChecklist)
      .where(eq(launchChecklist.dealershipId, dealershipId));
    
    const total = items.length;
    const completed = items.filter(i => i.status === 'completed' || i.status === 'skipped').length;
    const required = items.filter(i => i.isRequired).length;
    const requiredCompleted = items.filter(i => i.isRequired && (i.status === 'completed' || i.status === 'skipped')).length;
    
    return { total, completed, required, requiredCompleted };
  }
  
  async createLaunchChecklistItem(item: InsertLaunchChecklist): Promise<LaunchChecklist> {
    const result = await db.insert(launchChecklist).values(item).returning();
    return result[0];
  }
  
  async createLaunchChecklistItems(items: InsertLaunchChecklist[]): Promise<LaunchChecklist[]> {
    if (items.length === 0) return [];
    const result = await db.insert(launchChecklist).values(items).returning();
    return result;
  }
  
  async updateLaunchChecklistItem(id: number, dealershipId: number, item: Partial<InsertLaunchChecklist>): Promise<LaunchChecklist | undefined> {
    const result = await db.update(launchChecklist)
      .set({ ...item, updatedAt: new Date() })
      .where(and(
        eq(launchChecklist.id, id),
        eq(launchChecklist.dealershipId, dealershipId)
      ))
      .returning();
    return result[0];
  }
  
  async completeLaunchChecklistItem(id: number, dealershipId: number, userId: number): Promise<LaunchChecklist | undefined> {
    const result = await db.update(launchChecklist)
      .set({ 
        status: 'completed', 
        completedBy: userId, 
        completedAt: new Date(),
        updatedAt: new Date() 
      })
      .where(and(
        eq(launchChecklist.id, id),
        eq(launchChecklist.dealershipId, dealershipId)
      ))
      .returning();
    return result[0];
  }
  
  async skipLaunchChecklistItem(id: number, dealershipId: number, notes?: string): Promise<LaunchChecklist | undefined> {
    const result = await db.update(launchChecklist)
      .set({ 
        status: 'skipped', 
        notes: notes || null,
        updatedAt: new Date() 
      })
      .where(and(
        eq(launchChecklist.id, id),
        eq(launchChecklist.dealershipId, dealershipId)
      ))
      .returning();
    return result[0];
  }
  
  async deleteLaunchChecklistItem(id: number, dealershipId: number): Promise<boolean> {
    const result = await db.delete(launchChecklist)
      .where(and(
        eq(launchChecklist.id, id),
        eq(launchChecklist.dealershipId, dealershipId)
      ))
      .returning();
    return result.length > 0;
  }
  
  // ====== PRICE HISTORY ======
  async getPriceHistory(dealershipId: number, filters: { make?: string; model?: string; externalId?: string }, limit: number = 100): Promise<PriceHistory[]> {
    const conditions = [eq(priceHistory.dealershipId, dealershipId)];
    
    if (filters.make) {
      conditions.push(sql`LOWER(${priceHistory.make}) = LOWER(${filters.make})`);
    }
    if (filters.model) {
      conditions.push(sql`LOWER(${priceHistory.model}) = LOWER(${filters.model})`);
    }
    if (filters.externalId) {
      conditions.push(eq(priceHistory.externalId, filters.externalId));
    }
    
    return await db.select().from(priceHistory)
      .where(and(...conditions))
      .orderBy(desc(priceHistory.recordedAt))
      .limit(limit);
  }
  
  async createPriceHistory(record: InsertPriceHistory): Promise<PriceHistory> {
    const result = await db.insert(priceHistory).values(record).returning();
    return result[0];
  }
  
  async createPriceHistoryBatch(records: InsertPriceHistory[]): Promise<PriceHistory[]> {
    if (records.length === 0) return [];
    const result = await db.insert(priceHistory).values(records).returning();
    return result;
  }
  
  async getPriceHistoryForListing(dealershipId: number, externalId: string): Promise<PriceHistory[]> {
    return await db.select().from(priceHistory)
      .where(and(
        eq(priceHistory.dealershipId, dealershipId),
        eq(priceHistory.externalId, externalId)
      ))
      .orderBy(desc(priceHistory.recordedAt));
  }
  
  // ====== COMPETITOR DEALERS ======
  async getCompetitorDealers(dealershipId: number): Promise<CompetitorDealer[]> {
    return await db.select().from(competitorDealers)
      .where(and(
        eq(competitorDealers.dealershipId, dealershipId),
        eq(competitorDealers.isActive, true)
      ))
      .orderBy(competitorDealers.competitorName);
  }
  
  async getCompetitorDealerById(id: number, dealershipId: number): Promise<CompetitorDealer | undefined> {
    const result = await db.select().from(competitorDealers)
      .where(and(
        eq(competitorDealers.id, id),
        eq(competitorDealers.dealershipId, dealershipId)
      ))
      .limit(1);
    return result[0];
  }
  
  async createCompetitorDealer(dealer: InsertCompetitorDealer): Promise<CompetitorDealer> {
    const result = await db.insert(competitorDealers).values(dealer).returning();
    return result[0];
  }
  
  async updateCompetitorDealer(id: number, dealershipId: number, dealer: Partial<InsertCompetitorDealer>): Promise<CompetitorDealer | undefined> {
    const result = await db.update(competitorDealers)
      .set(dealer)
      .where(and(
        eq(competitorDealers.id, id),
        eq(competitorDealers.dealershipId, dealershipId)
      ))
      .returning();
    return result[0];
  }
  
  async deleteCompetitorDealer(id: number, dealershipId: number): Promise<boolean> {
    const result = await db.delete(competitorDealers)
      .where(and(
        eq(competitorDealers.id, id),
        eq(competitorDealers.dealershipId, dealershipId)
      ))
      .returning();
    return result.length > 0;
  }
  
  // ====== MARKET SNAPSHOTS ======
  async getMarketSnapshots(dealershipId: number, filters: { make?: string; model?: string; limit?: number }): Promise<MarketSnapshot[]> {
    const conditions = [eq(marketSnapshots.dealershipId, dealershipId)];
    
    if (filters.make) {
      conditions.push(sql`LOWER(${marketSnapshots.make}) = LOWER(${filters.make})`);
    }
    if (filters.model) {
      conditions.push(sql`LOWER(${marketSnapshots.model}) = LOWER(${filters.model})`);
    }
    
    return await db.select().from(marketSnapshots)
      .where(and(...conditions))
      .orderBy(desc(marketSnapshots.snapshotDate))
      .limit(filters.limit || 30);
  }
  
  async createMarketSnapshot(snapshot: InsertMarketSnapshot): Promise<MarketSnapshot> {
    const result = await db.insert(marketSnapshots).values(snapshot).returning();
    return result[0];
  }
  
  async getLatestMarketSnapshot(dealershipId: number, make: string, model: string): Promise<MarketSnapshot | undefined> {
    const result = await db.select().from(marketSnapshots)
      .where(and(
        eq(marketSnapshots.dealershipId, dealershipId),
        sql`LOWER(${marketSnapshots.make}) = LOWER(${make})`,
        sql`LOWER(${marketSnapshots.model}) = LOWER(${model})`
      ))
      .orderBy(desc(marketSnapshots.snapshotDate))
      .limit(1);
    return result[0];
  }
  
  async getLatestMarketSnapshotDate(dealershipId: number): Promise<Date | null> {
    // Get the most recent market listing scraped date for this dealership
    const result = await db.select({ scrapedAt: marketListings.scrapedAt })
      .from(marketListings)
      .where(eq(marketListings.dealershipId, dealershipId))
      .orderBy(desc(marketListings.scrapedAt))
      .limit(1);
    return result[0]?.scrapedAt || null;
  }
}

export const storage = new DatabaseStorage();
