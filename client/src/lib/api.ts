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
