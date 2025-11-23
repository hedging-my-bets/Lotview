import { db } from "./db";
import { ghlConfig } from "@shared/schema";
import { eq } from "drizzle-orm";

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

export class GHLClient {
  private apiKey: string;
  private locationId: string;

  constructor(apiKey: string, locationId: string) {
    this.apiKey = apiKey;
    this.locationId = locationId;
  }

  static async getInstance(): Promise<GHLClient | null> {
    try {
      const config = await db.query.ghlConfig.findFirst({
        where: eq(ghlConfig.isActive, true),
      });

      if (!config) {
        console.warn("No active GHL configuration found");
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
}
