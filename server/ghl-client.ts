import { db } from "./db";
import { ghlConfig } from "@shared/schema";
import { eq } from "drizzle-orm";
import { storage } from "./storage";

const GHL_BASE_URL = "https://services.leadconnectorhq.com";
const GHL_API_VERSION = "2021-04-15";

interface GHLContact {
  id: string;
  locationId: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
}

interface GHLConversation {
  id: string;
  locationId: string;
  contactId: string;
}

// Cache for GHL clients per dealership
const clientCache = new Map<number, GHLClient>();

export class GHLClient {
  private apiKey: string;
  private locationId: string;

  constructor(apiKey: string, locationId: string) {
    this.apiKey = apiKey;
    this.locationId = locationId;
  }

  /**
   * Get GHL client for a specific dealership
   * Fetches API key from database, caches instance for performance
   */
  static async getInstanceForDealership(dealershipId: number): Promise<GHLClient | null> {
    // Check cache first
    if (clientCache.has(dealershipId)) {
      return clientCache.get(dealershipId)!;
    }
    
    try {
      const apiKeys = await storage.getDealershipApiKeys(dealershipId);
      
      if (apiKeys?.ghlApiKey && apiKeys?.ghlLocationId) {
        const client = new GHLClient(apiKeys.ghlApiKey, apiKeys.ghlLocationId);
        clientCache.set(dealershipId, client);
        console.log(`[GHL] Client initialized for dealership ${dealershipId}`);
        return client;
      } else {
        console.warn(`[GHL] API key or Location ID not configured for dealership ${dealershipId}`);
        return null;
      }
    } catch (error) {
      console.error(`[GHL] Error loading configuration for dealership ${dealershipId}:`, error);
      return null;
    }
  }

  /**
   * Clear cached client instance (use when API key is updated)
   */
  static clearCache(dealershipId?: number) {
    if (dealershipId) {
      clientCache.delete(dealershipId);
    } else {
      clientCache.clear();
    }
  }

  // Legacy method for backwards compatibility (uses old ghlConfig table)
  static async getInstance(): Promise<GHLClient | null> {
    try {
      const config = await db.query.ghlConfig.findFirst({
        where: eq(ghlConfig.isActive, true),
      });

      if (!config) {
        console.warn("No active GHL configuration found - use getInstanceForDealership() instead");
        return null;
      }

      return new GHLClient(config.apiKey, config.locationId);
    } catch (error) {
      console.error("Error loading GHL configuration:", error);
      return null;
    }
  }

  private async makeRequest(endpoint: string, method: string = "GET", body?: any) {
    const url = `${GHL_BASE_URL}${endpoint}`;
    
    const headers: Record<string, string> = {
      "Authorization": `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
      "Version": GHL_API_VERSION,
    };

    const options: RequestInit = {
      method,
      headers,
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GHL API error (${response.status}): ${errorText}`);
    }

    return response.json();
  }

  async createOrUpdateContact(data: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    tags?: string[];
    customFields?: { id: string; value: string }[];
  }): Promise<GHLContact> {
    const payload = {
      locationId: this.locationId,
      ...data,
    };

    const result = await this.makeRequest("/contacts/", "POST", payload);
    return result.contact;
  }

  async getContactByEmail(email: string): Promise<GHLContact | null> {
    try {
      const result = await this.makeRequest(`/contacts/?email=${encodeURIComponent(email)}`);
      return result.contacts?.[0] || null;
    } catch (error) {
      console.error("Error fetching contact by email:", error);
      return null;
    }
  }

  async getContactByPhone(phone: string): Promise<GHLContact | null> {
    try {
      const result = await this.makeRequest(`/contacts/?phone=${encodeURIComponent(phone)}`);
      return result.contacts?.[0] || null;
    } catch (error) {
      console.error("Error fetching contact by phone:", error);
      return null;
    }
  }

  async createConversation(contactId: string, initialMessage: string): Promise<GHLConversation> {
    const payload = {
      locationId: this.locationId,
      contactId,
      lastMessageBody: initialMessage,
      lastMessageType: "TYPE_SMS",
      type: "TYPE_SMS",
    };

    const result = await this.makeRequest("/conversations/", "POST", payload);
    return result.conversation;
  }

  async sendMessage(contactId: string, message: string, conversationId?: string): Promise<void> {
    const payload: any = {
      locationId: this.locationId,
      contactId,
      type: "SMS",
      message,
    };

    if (conversationId) {
      payload.conversationId = conversationId;
    }

    await this.makeRequest("/conversations/messages", "POST", payload);
  }

  async handleCTAAction(
    vehicleInfo: {
      year: number;
      make: string;
      model: string;
      price: number;
      vin?: string;
      dealership: string;
    },
    ctaType: 'test-drive' | 'reserve' | 'get-approved' | 'value-trade',
    contactInfo?: {
      firstName?: string;
      lastName?: string;
      email?: string;
      phone?: string;
    }
  ): Promise<{ success: boolean; contactId?: string; error?: string }> {
    try {
      const vehicleName = `${vehicleInfo.year} ${vehicleInfo.make} ${vehicleInfo.model}`;
      
      const ctaMessages: Record<typeof ctaType, string> = {
        'test-drive': `🚗 New Test Drive Request\n\nVehicle: ${vehicleName}\nPrice: $${vehicleInfo.price.toLocaleString()}\nDealership: ${vehicleInfo.dealership}\n${vehicleInfo.vin ? `VIN: ${vehicleInfo.vin}` : ''}\n\nCustomer is interested in booking a test drive.`,
        'reserve': `⭐ New Vehicle Reservation Request\n\nVehicle: ${vehicleName}\nPrice: $${vehicleInfo.price.toLocaleString()}\nDealership: ${vehicleInfo.dealership}\n${vehicleInfo.vin ? `VIN: ${vehicleInfo.vin}` : ''}\n\nCustomer wants to reserve this vehicle.`,
        'get-approved': `💳 New Financing Pre-Approval Request\n\nVehicle: ${vehicleName}\nPrice: $${vehicleInfo.price.toLocaleString()}\nDealership: ${vehicleInfo.dealership}\n${vehicleInfo.vin ? `VIN: ${vehicleInfo.vin}` : ''}\n\nCustomer is interested in getting pre-approved for financing.`,
        'value-trade': `🔄 New Trade-In Valuation Request\n\nInterested Vehicle: ${vehicleName}\nPrice: $${vehicleInfo.price.toLocaleString()}\nDealership: ${vehicleInfo.dealership}\n${vehicleInfo.vin ? `VIN: ${vehicleInfo.vin}` : ''}\n\nCustomer wants to get a trade-in value for their current vehicle.`,
      };

      const message = ctaMessages[ctaType];
      const tags = [`cta-${ctaType}`, 'website-lead', vehicleInfo.dealership.toLowerCase().replace(/\s+/g, '-')];

      let contact: GHLContact;
      
      if (contactInfo?.email || contactInfo?.phone) {
        const existingContact = contactInfo.email 
          ? await this.getContactByEmail(contactInfo.email)
          : contactInfo.phone 
          ? await this.getContactByPhone(contactInfo.phone)
          : null;

        if (existingContact) {
          contact = existingContact;
        } else {
          contact = await this.createOrUpdateContact({
            ...contactInfo,
            tags,
            customFields: [
              { id: "interested_vehicle", value: vehicleName },
              { id: "cta_type", value: ctaType },
            ],
          });
        }
      } else {
        contact = await this.createOrUpdateContact({
          firstName: "Website",
          lastName: "Visitor",
          tags,
          customFields: [
            { id: "interested_vehicle", value: vehicleName },
            { id: "cta_type", value: ctaType },
          ],
        });
      }

      await this.sendMessage(contact.id, message);

      return { success: true, contactId: contact.id };
    } catch (error) {
      console.error("Error handling CTA action:", error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      };
    }
  }

  /**
   * Sync a chat conversation to GHL as a contact + conversation thread
   * Called when user requests SMS handoff
   */
  async syncChatConversation(data: {
    phone: string;
    sessionId: string;
    category: 'test-drive' | 'get-approved' | 'value-trade' | 'reserve' | 'general';
    vehicleName?: string;
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
    dealershipName?: string;
  }): Promise<{ success: boolean; contactId?: string; conversationId?: string; error?: string }> {
    try {
      const { phone, category, vehicleName, messages, dealershipName } = data;
      
      const categoryLabels: Record<string, string> = {
        'test-drive': 'Test Drive Request',
        'get-approved': 'Financing Pre-Approval',
        'value-trade': 'Trade-In Valuation',
        'reserve': 'Vehicle Reservation',
        'general': 'General Inquiry'
      };
      
      const categoryLabel = categoryLabels[category] || 'General Inquiry';
      const tags = [
        `chat-${category}`,
        'chatbot-lead',
        'website-lead',
        dealershipName?.toLowerCase().replace(/\s+/g, '-') || 'dealership'
      ].filter(Boolean);

      let contact = await this.getContactByPhone(phone);
      
      if (!contact) {
        contact = await this.createOrUpdateContact({
          phone,
          tags,
          customFields: [
            { id: "chat_category", value: categoryLabel },
            { id: "interested_vehicle", value: vehicleName || "Not specified" },
            { id: "lead_source", value: "AI Chatbot" }
          ]
        });
      }

      const chatSummary = messages
        .map((m, i) => `${m.role === 'user' ? '👤 Customer' : '🤖 AI'}: ${m.content}`)
        .join('\n\n');

      const initialMessage = 
`🔔 New AI Chat Lead - ${categoryLabel}
${vehicleName ? `📋 Interested in: ${vehicleName}` : ''}

📱 Chat Summary:
${chatSummary}

---
Customer requested SMS follow-up.`;

      const conversation = await this.createConversation(contact.id, initialMessage);

      console.log(`[GHL] Chat conversation synced - Contact: ${contact.id}, Conversation: ${conversation.id}`);

      return { 
        success: true, 
        contactId: contact.id, 
        conversationId: conversation.id 
      };
    } catch (error) {
      console.error("[GHL] Error syncing chat conversation:", error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      };
    }
  }

  /**
   * Create or update a lead in GHL from chat handoff
   */
  async createLeadFromChat(data: {
    phone: string;
    name?: string;
    email?: string;
    category: string;
    vehicleName?: string;
    vehicleId?: number;
    notes?: string;
  }): Promise<{ success: boolean; contactId?: string; error?: string }> {
    try {
      const tags = [
        'chatbot-lead',
        'website-lead',
        `interest-${data.category}`,
      ];

      let existingContact = await this.getContactByPhone(data.phone);
      
      if (!existingContact && data.email) {
        existingContact = await this.getContactByEmail(data.email);
      }

      const customFields: { id: string; value: string }[] = [
        { id: "lead_source", value: "AI Chatbot" },
        { id: "chat_category", value: data.category },
      ];

      if (data.vehicleName) {
        customFields.push({ id: "interested_vehicle", value: data.vehicleName });
      }

      if (data.vehicleId) {
        customFields.push({ id: "vehicle_id", value: data.vehicleId.toString() });
      }

      let contact: GHLContact;

      if (existingContact) {
        contact = existingContact;
      } else {
        const nameParts = data.name?.split(' ') || [];
        contact = await this.createOrUpdateContact({
          firstName: nameParts[0] || 'Chat',
          lastName: nameParts.slice(1).join(' ') || 'Lead',
          phone: data.phone,
          email: data.email,
          tags,
          customFields,
        });
      }

      if (data.notes) {
        await this.sendMessage(contact.id, `📝 Lead Notes:\n${data.notes}`);
      }

      console.log(`[GHL] Lead created from chat - Contact: ${contact.id}`);
      return { success: true, contactId: contact.id };
    } catch (error) {
      console.error("[GHL] Error creating lead from chat:", error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      };
    }
  }
}
