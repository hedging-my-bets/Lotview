import { pgTable, text, integer, serial, timestamp, boolean, sql } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Vehicles table
export const vehicles = pgTable("vehicles", {
  id: serial("id").primaryKey(),
  year: integer("year").notNull(),
  make: text("make").notNull(),
  model: text("model").notNull(),
  trim: text("trim").notNull(),
  type: text("type").notNull(), // SUV, Truck, Sedan, etc.
  price: integer("price").notNull(),
  odometer: integer("odometer").notNull(),
  image: text("image").notNull(),
  badges: text("badges").array().notNull(),
  location: text("location").notNull(), // Vancouver, Burnaby, Richmond
  description: text("description").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertVehicleSchema = createInsertSchema(vehicles).omit({
  id: true,
  createdAt: true,
});

export type InsertVehicle = z.infer<typeof insertVehicleSchema>;
export type Vehicle = typeof vehicles.$inferSelect;

// View tracking table
export const vehicleViews = pgTable("vehicle_views", {
  id: serial("id").primaryKey(),
  vehicleId: integer("vehicle_id").notNull().references(() => vehicles.id),
  sessionId: text("session_id").notNull(), // For remarketing tracking
  viewedAt: timestamp("viewed_at").defaultNow().notNull(),
});

export const insertVehicleViewSchema = createInsertSchema(vehicleViews).omit({
  id: true,
  viewedAt: true,
});

export type InsertVehicleView = z.infer<typeof insertVehicleViewSchema>;
export type VehicleView = typeof vehicleViews.$inferSelect;

// Facebook pages connected by sales team
export const facebookPages = pgTable("facebook_pages", {
  id: serial("id").primaryKey(),
  pageName: text("page_name").notNull(),
  pageId: text("page_id").notNull().unique(),
  accessToken: text("access_token"), // Optional - for future OAuth integration
  isActive: boolean("is_active").notNull().default(true),
  selectedTemplate: text("selected_template").notNull().default('modern'),
  connectedAt: timestamp("connected_at").defaultNow().notNull(),
});

export const insertFacebookPageSchema = createInsertSchema(facebookPages).omit({
  id: true,
  connectedAt: true,
});

export type InsertFacebookPage = z.infer<typeof insertFacebookPageSchema>;
export type FacebookPage = typeof facebookPages.$inferSelect;

// Priority inventory for each Facebook page
export const pagePriorityVehicles = pgTable("page_priority_vehicles", {
  id: serial("id").primaryKey(),
  pageId: integer("page_id").notNull().references(() => facebookPages.id),
  vehicleId: integer("vehicle_id").notNull().references(() => vehicles.id),
  priority: integer("priority").notNull(), // Order for posting
});

export const insertPagePriorityVehicleSchema = createInsertSchema(pagePriorityVehicles).omit({
  id: true,
});

export type InsertPagePriorityVehicle = z.infer<typeof insertPagePriorityVehicleSchema>;
export type PagePriorityVehicle = typeof pagePriorityVehicles.$inferSelect;
