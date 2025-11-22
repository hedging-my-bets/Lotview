import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { 
  vehicles, 
  vehicleViews, 
  facebookPages,
  pagePriorityVehicles,
  type Vehicle, 
  type InsertVehicle,
  type VehicleView,
  type InsertVehicleView,
  type FacebookPage,
  type InsertFacebookPage,
  type PagePriorityVehicle,
  type InsertPagePriorityVehicle
} from "@shared/schema";
import { eq, desc, sql, and } from "drizzle-orm";

const connectionString = process.env.DATABASE_URL!;
const queryClient = neon(connectionString);
export const db = drizzle(queryClient);

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
  
  // Facebook pages
  getFacebookPages(): Promise<FacebookPage[]>;
  createFacebookPage(page: InsertFacebookPage): Promise<FacebookPage>;
  updateFacebookPage(id: number, page: Partial<InsertFacebookPage>): Promise<FacebookPage | undefined>;
  
  // Priority vehicles
  getPagePriorityVehicles(pageId: number): Promise<PagePriorityVehicle[]>;
  setPagePriorityVehicles(pageId: number, vehicleIds: number[]): Promise<void>;
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
}

export const storage = new DatabaseStorage();
