import { db } from "./db";
import { 
  dealerships, users, dealershipApiKeys, dealershipSubscriptions,
  creditScoreTiers, modelYearTerms, dealershipFees, scrapeSources,
  chatPrompts, aiPromptTemplates, adTemplates, postingSchedule,
  dealershipBranding, dealershipContacts, staffInvites,
  onboardingRuns, onboardingRunSteps, integrationStatus
} from "@shared/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import crypto from "crypto";

// Types for onboarding input data
export interface OnboardingInput {
  // Step 1: Dealership Identity
  dealership: {
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
  };
  
  // Step 2: Branding & Contact
  branding: {
    logoUrl?: string;
    faviconUrl?: string;
    primaryColor?: string;
    secondaryColor?: string;
    heroHeadline?: string;
    heroSubheadline?: string;
    promoBannerText?: string;
    promoBannerActive?: boolean;
  };
  contacts: {
    supportEmail?: string;
    salesEmail?: string;
    salesPhone?: string;
    smsNumber?: string;
    websiteUrl?: string;
    privacyPolicyUrl?: string;
    termsOfServiceUrl?: string;
    businessHours?: string;
  };
  
  // Step 3: Integrations & API Keys
  apiKeys: {
    openaiApiKey?: string;
    marketcheckKey?: string;
    apifyToken?: string;
    apifyActorId?: string;
    geminiApiKey?: string;
    ghlApiKey?: string;
    ghlLocationId?: string;
    facebookAppId?: string;
    facebookAppSecret?: string;
    gtmContainerId?: string;
    googleAnalyticsId?: string;
    googleAdsId?: string;
    facebookPixelId?: string;
  };
  
  // Step 4: Inventory Sources (Scrapers)
  scrapeSources: Array<{
    sourceName: string;
    sourceUrl: string;
    sourceType: string;
    scrapeFrequency: string;
  }>;
  
  // Step 5: Staff Members
  masterAdmin: {
    email: string;
    name: string;
    password: string;
  };
  additionalStaff: Array<{
    email: string;
    name: string;
    role: 'manager' | 'salesperson';
  }>;
  
  // Step 6: Subscription Plan
  subscription: {
    plan: 'starter' | 'professional' | 'enterprise';
  };
}

// Default financing tiers (Canadian market)
const DEFAULT_CREDIT_TIERS = [
  { tierName: 'Excellent', minScore: 720, maxScore: 850, interestRate: 499 }, // 4.99%
  { tierName: 'Very Good', minScore: 680, maxScore: 719, interestRate: 649 }, // 6.49%
  { tierName: 'Good', minScore: 620, maxScore: 679, interestRate: 849 }, // 8.49%
  { tierName: 'Fair', minScore: 580, maxScore: 619, interestRate: 1249 }, // 12.49%
  { tierName: 'Poor', minScore: 300, maxScore: 579, interestRate: 1999 }, // 19.99%
];

// Default model year terms
const currentYear = new Date().getFullYear();
const DEFAULT_MODEL_YEAR_TERMS = [
  { minModelYear: currentYear - 1, maxModelYear: currentYear + 1, availableTerms: ['24', '36', '48', '60', '72', '84'] },
  { minModelYear: currentYear - 4, maxModelYear: currentYear - 2, availableTerms: ['24', '36', '48', '60', '72'] },
  { minModelYear: currentYear - 7, maxModelYear: currentYear - 5, availableTerms: ['24', '36', '48', '60'] },
  { minModelYear: currentYear - 10, maxModelYear: currentYear - 8, availableTerms: ['24', '36', '48'] },
  { minModelYear: 2000, maxModelYear: currentYear - 11, availableTerms: ['24', '36'] },
];

// Default dealership fees
const DEFAULT_FEES = [
  { feeName: 'Admin Fee', feeAmount: 49900, isPercentage: false, includeInPayment: true, displayOrder: 1 },
  { feeName: 'Documentation Fee', feeAmount: 19900, isPercentage: false, includeInPayment: true, displayOrder: 2 },
  { feeName: 'Tire & Battery Levy', feeAmount: 2000, isPercentage: false, includeInPayment: true, displayOrder: 3 },
];

// Default chat prompts for different scenarios
const DEFAULT_CHAT_PROMPTS = [
  {
    scenario: 'general',
    systemPrompt: `You are a friendly and knowledgeable automotive sales assistant for {dealership_name}. Your role is to help customers find their perfect vehicle, answer questions about our inventory, and guide them through the car buying process. Be helpful, professional, and enthusiastic about helping customers. If a customer is ready to proceed or needs human assistance, offer to connect them with our sales team.`,
    greeting: `Hello! Welcome to {dealership_name}! I'm here to help you find your perfect vehicle. How can I assist you today?`,
  },
  {
    scenario: 'test-drive',
    systemPrompt: `You are a helpful assistant at {dealership_name} focused on scheduling test drives. Collect the customer's preferred date/time, the vehicle they're interested in, and their contact information. Be enthusiastic about getting them behind the wheel!`,
    greeting: `Great choice on wanting to test drive! I'd love to help you schedule that. Which vehicle caught your eye?`,
  },
  {
    scenario: 'get-approved',
    systemPrompt: `You are a finance assistant at {dealership_name}. Help customers understand their financing options and collect basic information to start the pre-approval process. Be reassuring about credit concerns and emphasize our range of financing options for all credit situations.`,
    greeting: `I'm here to help you get pre-approved for financing! It's quick and easy. Would you like to start with some basic questions?`,
  },
  {
    scenario: 'value-trade',
    systemPrompt: `You are a trade-in specialist at {dealership_name}. Help customers get an estimate for their current vehicle's trade-in value. Collect year, make, model, trim, mileage, and condition information to provide an accurate estimate.`,
    greeting: `Looking to trade in your current vehicle? I can help you get an estimate! Tell me about your vehicle.`,
  },
  {
    scenario: 'reserve',
    systemPrompt: `You are a reservation specialist at {dealership_name}. Help customers reserve a vehicle they're interested in. Collect their contact information and the vehicle details, then assure them we'll hold the vehicle for them.`,
    greeting: `Want to reserve a vehicle? Smart move! Which vehicle are you interested in securing?`,
  },
];

// Default AI prompt templates for vehicle descriptions
const DEFAULT_AI_TEMPLATES = [
  {
    name: 'Vehicle Description',
    promptText: `Write a compelling, professional vehicle description for a {year} {make} {model} {trim}. 
    Key features: {features}
    Kilometers: {odometer}
    Price: ${'{price}'}
    
    The description should:
    - Highlight key selling points
    - Be 2-3 paragraphs long
    - Sound enthusiastic but professional
    - Mention any luxury or safety features
    - Include a call to action`,
  },
  {
    name: 'Short Description',
    promptText: `Write a short, punchy description (2-3 sentences) for a {year} {make} {model} {trim} with {odometer} km. Highlight the best features and value proposition.`,
  },
  {
    name: 'Facebook Post',
    promptText: `Create an engaging Facebook Marketplace post for a {year} {make} {model} {trim}. 
    Price: ${'{price}'}
    Kilometers: {odometer}
    Features: {features}
    
    Make it eye-catching with emojis and a clear call to action. Keep it under 300 characters.`,
  },
];

// Default ad template for Facebook posts
const DEFAULT_AD_TEMPLATE = {
  templateName: 'Standard Listing',
  titleTemplate: '{year} {make} {model} {trim} - ${price}',
  descriptionTemplate: `🚗 {year} {make} {model} {trim}
💰 ${'{price}'} 
📍 {location}
⚡ {odometer} km

✅ One Owner
✅ Clean Carfax
✅ Fully Inspected

📱 Call or text us today to schedule a test drive!

🔗 View full details: {vdp_url}`,
};

// Onboarding step definitions
const ONBOARDING_STEPS = [
  { name: 'create_dealership', order: 1, description: 'Create dealership record' },
  { name: 'create_subscription', order: 2, description: 'Set up subscription' },
  { name: 'create_branding', order: 3, description: 'Configure branding' },
  { name: 'create_contacts', order: 4, description: 'Set up contact channels' },
  { name: 'create_api_keys', order: 5, description: 'Configure API integrations' },
  { name: 'seed_financing', order: 6, description: 'Set up financing rules' },
  { name: 'seed_chat_prompts', order: 7, description: 'Configure AI chat prompts' },
  { name: 'seed_ai_templates', order: 8, description: 'Set up AI templates' },
  { name: 'create_scrape_sources', order: 9, description: 'Configure inventory sources' },
  { name: 'create_master_admin', order: 10, description: 'Create master admin account' },
  { name: 'create_staff_invites', order: 11, description: 'Send staff invitations' },
  { name: 'initialize_integrations', order: 12, description: 'Initialize integration status' },
];

export class OnboardingService {
  private runId: number | null = null;
  private dealershipId: number | null = null;
  
  async startOnboarding(input: OnboardingInput, initiatedBy: number): Promise<{ runId: number; dealershipId: number }> {
    // Create onboarding run record
    const [run] = await db.insert(onboardingRuns).values({
      status: 'pending',
      initiatedBy,
      inputData: JSON.stringify(input),
      totalSteps: ONBOARDING_STEPS.length,
      completedSteps: 0,
    }).returning();
    
    this.runId = run.id;
    
    // Create step records
    for (const step of ONBOARDING_STEPS) {
      await db.insert(onboardingRunSteps).values({
        runId: run.id,
        stepName: step.name,
        stepOrder: step.order,
        status: 'pending',
      });
    }
    
    // Update run status to in_progress
    await db.update(onboardingRuns)
      .set({ status: 'in_progress', startedAt: new Date() })
      .where(eq(onboardingRuns.id, run.id));
    
    try {
      // Execute each step
      await this.executeStep('create_dealership', () => this.createDealership(input.dealership));
      await this.executeStep('create_subscription', () => this.createSubscription(input.subscription));
      await this.executeStep('create_branding', () => this.createBranding(input.branding));
      await this.executeStep('create_contacts', () => this.createContacts(input.contacts));
      await this.executeStep('create_api_keys', () => this.createApiKeys(input.apiKeys));
      await this.executeStep('seed_financing', () => this.seedFinancing());
      await this.executeStep('seed_chat_prompts', () => this.seedChatPrompts(input.dealership.name));
      await this.executeStep('seed_ai_templates', () => this.seedAiTemplates());
      await this.executeStep('create_scrape_sources', () => this.createScrapeSources(input.scrapeSources));
      const masterAdminId = await this.executeStep('create_master_admin', () => this.createMasterAdmin(input.masterAdmin));
      await this.executeStep('create_staff_invites', () => this.createStaffInvites(input.additionalStaff, masterAdminId as number));
      await this.executeStep('initialize_integrations', () => this.initializeIntegrations(input.apiKeys));
      
      // Mark onboarding as completed
      await db.update(onboardingRuns)
        .set({ 
          status: 'completed', 
          completedAt: new Date(),
          dealershipId: this.dealershipId,
        })
        .where(eq(onboardingRuns.id, run.id));
      
      return { runId: run.id, dealershipId: this.dealershipId! };
      
    } catch (error) {
      // Mark onboarding as failed
      await db.update(onboardingRuns)
        .set({ 
          status: 'failed', 
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          dealershipId: this.dealershipId,
        })
        .where(eq(onboardingRuns.id, run.id));
      
      throw error;
    }
  }
  
  private async executeStep<T>(stepName: string, fn: () => Promise<T>): Promise<T> {
    if (!this.runId) throw new Error('Onboarding run not initialized');
    
    // Mark step as in_progress
    await db.update(onboardingRunSteps)
      .set({ status: 'in_progress', startedAt: new Date() })
      .where(eq(onboardingRunSteps.runId, this.runId));
    
    try {
      const result = await fn();
      
      // Mark step as completed
      await db.update(onboardingRunSteps)
        .set({ 
          status: 'completed', 
          completedAt: new Date(),
          details: JSON.stringify({ success: true }),
        })
        .where(eq(onboardingRunSteps.runId, this.runId));
      
      // Update completed steps count
      await db.update(onboardingRuns)
        .set({ completedSteps: await this.getCompletedStepsCount() })
        .where(eq(onboardingRuns.id, this.runId));
      
      return result;
      
    } catch (error) {
      // Mark step as failed
      await db.update(onboardingRunSteps)
        .set({ 
          status: 'failed', 
          completedAt: new Date(),
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        })
        .where(eq(onboardingRunSteps.runId, this.runId));
      
      throw error;
    }
  }
  
  private async getCompletedStepsCount(): Promise<number> {
    if (!this.runId) return 0;
    const steps = await db.select()
      .from(onboardingRunSteps)
      .where(eq(onboardingRunSteps.runId, this.runId));
    return steps.filter(s => s.status === 'completed').length;
  }
  
  // Step implementations
  
  private async createDealership(data: OnboardingInput['dealership']): Promise<void> {
    const [dealership] = await db.insert(dealerships).values({
      name: data.name,
      slug: data.slug,
      subdomain: data.subdomain,
      address: data.address,
      city: data.city,
      province: data.province,
      postalCode: data.postalCode,
      phone: data.phone,
      timezone: data.timezone || 'America/Vancouver',
      defaultCurrency: data.defaultCurrency || 'CAD',
      isActive: true,
    }).returning();
    
    this.dealershipId = dealership.id;
  }
  
  private async createSubscription(data: OnboardingInput['subscription']): Promise<void> {
    if (!this.dealershipId) throw new Error('Dealership not created');
    
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 14); // 14-day trial
    
    await db.insert(dealershipSubscriptions).values({
      dealershipId: this.dealershipId,
      plan: data.plan,
      status: 'trial',
      currentPeriodEnd: trialEnd,
    });
  }
  
  private async createBranding(data: OnboardingInput['branding']): Promise<void> {
    if (!this.dealershipId) throw new Error('Dealership not created');
    
    await db.insert(dealershipBranding).values({
      dealershipId: this.dealershipId,
      logoUrl: data.logoUrl,
      faviconUrl: data.faviconUrl,
      primaryColor: data.primaryColor || '#022d60',
      secondaryColor: data.secondaryColor || '#00aad2',
      heroHeadline: data.heroHeadline,
      heroSubheadline: data.heroSubheadline,
      promoBannerText: data.promoBannerText,
      promoBannerActive: data.promoBannerActive || false,
    });
  }
  
  private async createContacts(data: OnboardingInput['contacts']): Promise<void> {
    if (!this.dealershipId) throw new Error('Dealership not created');
    
    await db.insert(dealershipContacts).values({
      dealershipId: this.dealershipId,
      supportEmail: data.supportEmail,
      salesEmail: data.salesEmail,
      salesPhone: data.salesPhone,
      smsNumber: data.smsNumber,
      websiteUrl: data.websiteUrl,
      privacyPolicyUrl: data.privacyPolicyUrl,
      termsOfServiceUrl: data.termsOfServiceUrl,
      businessHours: data.businessHours,
    });
  }
  
  private async createApiKeys(data: OnboardingInput['apiKeys']): Promise<void> {
    if (!this.dealershipId) throw new Error('Dealership not created');
    
    await db.insert(dealershipApiKeys).values({
      dealershipId: this.dealershipId,
      openaiApiKey: data.openaiApiKey,
      marketcheckKey: data.marketcheckKey,
      apifyToken: data.apifyToken,
      apifyActorId: data.apifyActorId,
      geminiApiKey: data.geminiApiKey,
      ghlApiKey: data.ghlApiKey,
      ghlLocationId: data.ghlLocationId,
      facebookAppId: data.facebookAppId,
      facebookAppSecret: data.facebookAppSecret,
      gtmContainerId: data.gtmContainerId,
      googleAnalyticsId: data.googleAnalyticsId,
      googleAdsId: data.googleAdsId,
      facebookPixelId: data.facebookPixelId,
    });
  }
  
  private async seedFinancing(): Promise<void> {
    if (!this.dealershipId) throw new Error('Dealership not created');
    
    // Seed credit score tiers
    for (const tier of DEFAULT_CREDIT_TIERS) {
      await db.insert(creditScoreTiers).values({
        dealershipId: this.dealershipId,
        tierName: tier.tierName,
        minScore: tier.minScore,
        maxScore: tier.maxScore,
        interestRate: tier.interestRate,
        isActive: true,
      });
    }
    
    // Seed model year terms
    for (const term of DEFAULT_MODEL_YEAR_TERMS) {
      await db.insert(modelYearTerms).values({
        dealershipId: this.dealershipId,
        minModelYear: term.minModelYear,
        maxModelYear: term.maxModelYear,
        availableTerms: term.availableTerms,
        isActive: true,
      });
    }
    
    // Seed default fees
    for (const fee of DEFAULT_FEES) {
      await db.insert(dealershipFees).values({
        dealershipId: this.dealershipId,
        feeName: fee.feeName,
        feeAmount: fee.feeAmount,
        isPercentage: fee.isPercentage,
        includeInPayment: fee.includeInPayment,
        displayOrder: fee.displayOrder,
        isActive: true,
      });
    }
  }
  
  private async seedChatPrompts(dealershipName: string): Promise<void> {
    if (!this.dealershipId) throw new Error('Dealership not created');
    
    for (const prompt of DEFAULT_CHAT_PROMPTS) {
      await db.insert(chatPrompts).values({
        dealershipId: this.dealershipId,
        scenario: prompt.scenario,
        systemPrompt: prompt.systemPrompt.replace('{dealership_name}', dealershipName),
        greeting: prompt.greeting.replace('{dealership_name}', dealershipName),
        isActive: true,
      });
    }
  }
  
  private async seedAiTemplates(): Promise<void> {
    if (!this.dealershipId) throw new Error('Dealership not created');
    
    // Get the master admin user for this dealership (needed for ad templates)
    const [masterUser] = await db.select().from(users)
      .where(eq(users.dealershipId, this.dealershipId));
    
    for (const template of DEFAULT_AI_TEMPLATES) {
      await db.insert(aiPromptTemplates).values({
        dealershipId: this.dealershipId,
        name: template.name,
        promptText: template.promptText,
        isActive: true,
      });
    }
  }
  
  private async createScrapeSources(sources: OnboardingInput['scrapeSources']): Promise<void> {
    if (!this.dealershipId) throw new Error('Dealership not created');
    
    for (const source of sources) {
      await db.insert(scrapeSources).values({
        dealershipId: this.dealershipId,
        sourceName: source.sourceName,
        sourceUrl: source.sourceUrl,
        sourceType: source.sourceType,
        scrapeFrequency: source.scrapeFrequency,
        isActive: true,
      });
    }
  }
  
  private async createMasterAdmin(data: OnboardingInput['masterAdmin']): Promise<number> {
    if (!this.dealershipId) throw new Error('Dealership not created');
    
    const passwordHash = await bcrypt.hash(data.password, 10);
    
    const [user] = await db.insert(users).values({
      dealershipId: this.dealershipId,
      email: data.email,
      passwordHash,
      name: data.name,
      role: 'master',
      isActive: true,
    }).returning();
    
    // Create default ad template for the master user
    await db.insert(adTemplates).values({
      dealershipId: this.dealershipId,
      userId: user.id,
      templateName: DEFAULT_AD_TEMPLATE.templateName,
      titleTemplate: DEFAULT_AD_TEMPLATE.titleTemplate,
      descriptionTemplate: DEFAULT_AD_TEMPLATE.descriptionTemplate,
      isDefault: true,
    });
    
    return user.id;
  }
  
  private async createStaffInvites(staff: OnboardingInput['additionalStaff'], invitedBy: number): Promise<void> {
    if (!this.dealershipId) throw new Error('Dealership not created');
    
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7-day expiry
    
    for (const member of staff) {
      const inviteToken = crypto.randomBytes(32).toString('hex');
      
      await db.insert(staffInvites).values({
        dealershipId: this.dealershipId,
        email: member.email,
        name: member.name,
        role: member.role,
        inviteToken,
        status: 'pending',
        invitedBy,
        expiresAt,
      });
    }
  }
  
  private async initializeIntegrations(apiKeys: OnboardingInput['apiKeys']): Promise<void> {
    if (!this.dealershipId) throw new Error('Dealership not created');
    
    const integrations = [
      { name: 'openai', hasKey: !!apiKeys.openaiApiKey },
      { name: 'marketcheck', hasKey: !!apiKeys.marketcheckKey },
      { name: 'apify', hasKey: !!apiKeys.apifyToken },
      { name: 'gemini', hasKey: !!apiKeys.geminiApiKey },
      { name: 'ghl', hasKey: !!apiKeys.ghlApiKey },
      { name: 'facebook', hasKey: !!apiKeys.facebookAppId },
      { name: 'google_analytics', hasKey: !!apiKeys.googleAnalyticsId },
      { name: 'google_ads', hasKey: !!apiKeys.googleAdsId },
      { name: 'facebook_pixel', hasKey: !!apiKeys.facebookPixelId },
    ];
    
    for (const integration of integrations) {
      await db.insert(integrationStatus).values({
        dealershipId: this.dealershipId,
        integrationName: integration.name,
        status: integration.hasKey ? 'pending' : 'not_configured',
      });
    }
  }
  
  // Get onboarding run status
  static async getRunStatus(runId: number) {
    const [run] = await db.select().from(onboardingRuns).where(eq(onboardingRuns.id, runId));
    if (!run) return null;
    
    const steps = await db.select().from(onboardingRunSteps)
      .where(eq(onboardingRunSteps.runId, runId));
    
    return {
      ...run,
      steps: steps.sort((a, b) => a.stepOrder - b.stepOrder),
    };
  }
  
  // Get all onboarding runs
  static async getAllRuns() {
    return db.select().from(onboardingRuns);
  }
  
  // Validate onboarding input
  static validateInput(input: Partial<OnboardingInput>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!input.dealership?.name) errors.push('Dealership name is required');
    if (!input.dealership?.slug) errors.push('Dealership slug is required');
    if (!input.dealership?.subdomain) errors.push('Dealership subdomain is required');
    if (!input.masterAdmin?.email) errors.push('Master admin email is required');
    if (!input.masterAdmin?.name) errors.push('Master admin name is required');
    if (!input.masterAdmin?.password) errors.push('Master admin password is required');
    if (input.masterAdmin?.password && input.masterAdmin.password.length < 8) {
      errors.push('Password must be at least 8 characters');
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (input.masterAdmin?.email && !emailRegex.test(input.masterAdmin.email)) {
      errors.push('Invalid master admin email format');
    }
    
    // Validate slug format (lowercase, alphanumeric, hyphens only)
    const slugRegex = /^[a-z0-9-]+$/;
    if (input.dealership?.slug && !slugRegex.test(input.dealership.slug)) {
      errors.push('Slug must be lowercase letters, numbers, and hyphens only');
    }
    
    // Validate subdomain format
    if (input.dealership?.subdomain && !slugRegex.test(input.dealership.subdomain)) {
      errors.push('Subdomain must be lowercase letters, numbers, and hyphens only');
    }
    
    // Validate staff emails
    if (input.additionalStaff) {
      for (const staff of input.additionalStaff) {
        if (!emailRegex.test(staff.email)) {
          errors.push(`Invalid email format for staff member: ${staff.name}`);
        }
      }
    }
    
    return { valid: errors.length === 0, errors };
  }
}

export const onboardingService = new OnboardingService();
