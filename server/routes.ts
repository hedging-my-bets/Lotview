import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertVehicleSchema, insertVehicleViewSchema, insertFacebookPageSchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";

export async function registerRoutes(app: Express): Promise<Server> {
  
  // ===== VEHICLE ROUTES =====
  
  // Get all vehicles
  app.get("/api/vehicles", async (req, res) => {
    try {
      const vehicles = await storage.getVehicles();
      res.json(vehicles);
    } catch (error) {
      console.error("Error fetching vehicles:", error);
      res.status(500).json({ error: "Failed to fetch vehicles" });
    }
  });

  // Get vehicle by ID with view count
  app.get("/api/vehicles/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const vehicle = await storage.getVehicleById(id);
      
      if (!vehicle) {
        return res.status(404).json({ error: "Vehicle not found" });
      }

      // Get view count for last 24 hours
      const views = await storage.getVehicleViews(id, 24);
      
      res.json({ ...vehicle, views });
    } catch (error) {
      console.error("Error fetching vehicle:", error);
      res.status(500).json({ error: "Failed to fetch vehicle" });
    }
  });

  // Create vehicle
  app.post("/api/vehicles", async (req, res) => {
    try {
      const parsed = insertVehicleSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: fromZodError(parsed.error).message });
      }

      const vehicle = await storage.createVehicle(parsed.data);
      res.status(201).json(vehicle);
    } catch (error) {
      console.error("Error creating vehicle:", error);
      res.status(500).json({ error: "Failed to create vehicle" });
    }
  });

  // Update vehicle
  app.patch("/api/vehicles/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const parsed = insertVehicleSchema.partial().safeParse(req.body);
      
      if (!parsed.success) {
        return res.status(400).json({ error: fromZodError(parsed.error).message });
      }

      const vehicle = await storage.updateVehicle(id, parsed.data);
      
      if (!vehicle) {
        return res.status(404).json({ error: "Vehicle not found" });
      }

      res.json(vehicle);
    } catch (error) {
      console.error("Error updating vehicle:", error);
      res.status(500).json({ error: "Failed to update vehicle" });
    }
  });

  // Delete vehicle
  app.delete("/api/vehicles/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteVehicle(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting vehicle:", error);
      res.status(500).json({ error: "Failed to delete vehicle" });
    }
  });

  // ===== VIEW TRACKING ROUTES =====
  
  // Track vehicle view (for remarketing)
  app.post("/api/vehicles/:id/view", async (req, res) => {
    try {
      const vehicleId = parseInt(req.params.id);
      const sessionId = req.body.sessionId || req.sessionID || `session-${Date.now()}`;

      const view = await storage.trackVehicleView({
        vehicleId,
        sessionId
      });

      res.status(201).json(view);
    } catch (error) {
      console.error("Error tracking view:", error);
      res.status(500).json({ error: "Failed to track view" });
    }
  });

  // Get vehicle view count
  app.get("/api/vehicles/:id/views", async (req, res) => {
    try {
      const vehicleId = parseInt(req.params.id);
      const hours = parseInt(req.query.hours as string) || 24;
      
      const count = await storage.getVehicleViews(vehicleId, hours);
      res.json({ vehicleId, hours, count });
    } catch (error) {
      console.error("Error fetching views:", error);
      res.status(500).json({ error: "Failed to fetch views" });
    }
  });

  // ===== FACEBOOK PAGES ROUTES =====
  
  // Get all connected Facebook pages
  app.get("/api/facebook-pages", async (req, res) => {
    try {
      const pages = await storage.getFacebookPages();
      res.json(pages);
    } catch (error) {
      console.error("Error fetching pages:", error);
      res.status(500).json({ error: "Failed to fetch pages" });
    }
  });

  // Connect a Facebook page
  app.post("/api/facebook-pages", async (req, res) => {
    try {
      const parsed = insertFacebookPageSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: fromZodError(parsed.error).message });
      }

      const page = await storage.createFacebookPage(parsed.data);
      res.status(201).json(page);
    } catch (error) {
      console.error("Error connecting page:", error);
      res.status(500).json({ error: "Failed to connect page" });
    }
  });

  // Update Facebook page (template, etc.)
  app.patch("/api/facebook-pages/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const page = await storage.updateFacebookPage(id, req.body);
      
      if (!page) {
        return res.status(404).json({ error: "Page not found" });
      }

      res.json(page);
    } catch (error) {
      console.error("Error updating page:", error);
      res.status(500).json({ error: "Failed to update page" });
    }
  });

  // Get priority vehicles for a page
  app.get("/api/facebook-pages/:id/priority-vehicles", async (req, res) => {
    try {
      const pageId = parseInt(req.params.id);
      const priorities = await storage.getPagePriorityVehicles(pageId);
      res.json(priorities);
    } catch (error) {
      console.error("Error fetching priorities:", error);
      res.status(500).json({ error: "Failed to fetch priorities" });
    }
  });

  // Set priority vehicles for a page
  app.post("/api/facebook-pages/:id/priority-vehicles", async (req, res) => {
    try {
      const pageId = parseInt(req.params.id);
      const { vehicleIds } = req.body;

      if (!Array.isArray(vehicleIds)) {
        return res.status(400).json({ error: "vehicleIds must be an array" });
      }

      await storage.setPagePriorityVehicles(pageId, vehicleIds);
      res.status(200).json({ success: true });
    } catch (error) {
      console.error("Error setting priorities:", error);
      res.status(500).json({ error: "Failed to set priorities" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
