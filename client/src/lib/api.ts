import type { Vehicle } from "@shared/schema";

export interface VehicleWithViews extends Vehicle {
  views: number;
}

// Financing Rules Types
export interface CreditTier {
  tierName: string;
  minScore: number;
  maxScore: number;
  interestRate: number; // As percentage (e.g., 5.99)
}

export interface ModelYearTerm {
  minModelYear: number;
  maxModelYear: number;
  availableTerms: number[]; // e.g., [36, 48, 60, 72, 84]
}

export interface FinancingRules {
  creditTiers: CreditTier[];
  modelYearTerms: ModelYearTerm[];
}

// Financing Rules API (Public, no auth required)
export async function getFinancingRules(): Promise<FinancingRules> {
  const response = await fetch("/api/public/financing-rules");
  if (!response.ok) throw new Error("Failed to fetch financing rules");
  return response.json();
}

// Vehicle API
export async function getVehicles(): Promise<Vehicle[]> {
  // Note: Dealership filtering is handled automatically by server-side tenant middleware
  // based on subdomain resolution - no need to pass dealershipId param
  const response = await fetch("/api/vehicles");
  if (!response.ok) throw new Error("Failed to fetch vehicles");
  return response.json();
}

export async function getVehicleById(id: number): Promise<VehicleWithViews> {
  const response = await fetch(`/api/vehicles/${id}`);
  if (!response.ok) throw new Error("Failed to fetch vehicle");
  return response.json();
}

export async function trackVehicleView(vehicleId: number, sessionId: string): Promise<void> {
  const response = await fetch(`/api/vehicles/${vehicleId}/view`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId }),
  });
  if (!response.ok) throw new Error("Failed to track view");
}

// Facebook Pages API
export interface FacebookPage {
  id: number;
  pageName: string;
  pageId: string;
  isActive: boolean;
  selectedTemplate: string;
  connectedAt: string;
}

export async function getFacebookPages(): Promise<FacebookPage[]> {
  const response = await fetch("/api/facebook-pages");
  if (!response.ok) throw new Error("Failed to fetch pages");
  return response.json();
}

export async function createFacebookPage(pageName: string, pageId: string): Promise<FacebookPage> {
  const response = await fetch("/api/facebook-pages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pageName, pageId, isActive: true }),
  });
  if (!response.ok) throw new Error("Failed to create page");
  return response.json();
}

export async function updateFacebookPage(id: number, data: Partial<FacebookPage>): Promise<FacebookPage> {
  const response = await fetch(`/api/facebook-pages/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error("Failed to update page");
  return response.json();
}

// Chat API
export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export async function sendChatMessage(
  messages: ChatMessage[],
  vehicleContext?: string,
  scenario?: string,
  dealershipId?: number
): Promise<string> {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, vehicleContext, scenario, dealershipId }),
  });
  if (!response.ok) throw new Error("Failed to send chat message");
  const data = await response.json();
  return data.message;
}

export async function saveConversation(
  category: string,
  messages: ChatMessage[],
  sessionId: string,
  vehicleId?: number,
  vehicleName?: string,
  dealershipId?: number
): Promise<{ id: number } | undefined> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (dealershipId) {
    headers["x-dealership-id"] = dealershipId.toString();
  }
  const response = await fetch("/api/conversations", {
    method: "POST",
    headers,
    credentials: "include",
    body: JSON.stringify({ category, messages, sessionId, vehicleId, vehicleName }),
  });
  if (!response.ok) throw new Error("Failed to save conversation");
  return response.json();
}

// GoHighLevel CTA API
export async function sendCTAToGHL(
  vehicleInfo: {
    year: number;
    make: string;
    model: string;
    price: number;
    vin?: string | null;
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
  const response = await fetch("/api/cta/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ vehicleInfo, ctaType, contactInfo }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to send CTA to GoHighLevel");
  }
  
  return response.json();
}
