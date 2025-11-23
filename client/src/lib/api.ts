import type { Vehicle } from "@shared/schema";

export interface VehicleWithViews extends Vehicle {
  views: number;
}

// Vehicle API
export async function getVehicles(): Promise<Vehicle[]> {
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
  vehicleContext?: string
): Promise<string> {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, vehicleContext }),
  });
  if (!response.ok) throw new Error("Failed to send chat message");
  const data = await response.json();
  return data.message;
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
