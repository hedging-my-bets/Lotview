import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertVehicleSchema, insertVehicleViewSchema, insertFacebookPageSchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";
import { triggerManualSync } from "./scheduler";
import { testBadgeDetection } from "./scraper";
import { generateChatResponse, type ChatMessage } from "./openai";

export async function registerRoutes(app: Express): Promise<Server> {
  
  // ===== VEHICLE ROUTES =====
  
  // Get all vehicles with 24h view counts (randomized for engagement)
  app.get("/api/vehicles", async (req, res) => {
    try {
      const vehicles = await storage.getVehicles();
      
      // Add randomized view counts (5-35 views) to create social proof
      const vehiclesWithViews = vehicles.map(vehicle => ({
        ...vehicle,
        views: Math.floor(Math.random() * (35 - 5 + 1)) + 5 // Random between 5-35
      }));
      
      res.json(vehiclesWithViews);
    } catch (error) {
      console.error("Error fetching vehicles:", error);
      res.status(500).json({ error: "Failed to fetch vehicles" });
    }
  });

  // Get vehicle by ID with view count (randomized for engagement)
  app.get("/api/vehicles/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const vehicle = await storage.getVehicleById(id);
      
      if (!vehicle) {
        return res.status(404).json({ error: "Vehicle not found" });
      }

      // Generate randomized view count (5-35 views) for social proof
      const views = Math.floor(Math.random() * (35 - 5 + 1)) + 5;
      
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

  // Generate video for vehicle using Gemini Veo
  app.post("/api/vehicles/:id/generate-video", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const vehicle = await storage.getVehicleById(id);
      
      if (!vehicle) {
        return res.status(404).json({ error: "Vehicle not found" });
      }

      // Note: Video generation using Gemini Veo 3.1 would be triggered here
      // Cost: ~$0.15/second (6-8 seconds = ~$0.90-$1.20 per video)
      // Time: ~1 minute generation time per video
      // 
      // The generate_video_tool is available in the Replit agent context
      // For production, this would:
      // 1. Create a prompt describing the vehicle
      // 2. Call Gemini Veo API to generate video from vehicle images
      // 3. Save the video URL to attached_assets/generated_videos/
      // 4. Update the vehicle record with the video URL
      //
      // Example prompt:
      // `Cinematic showcase of a ${vehicle.year} ${vehicle.make} ${vehicle.model}, 
      //  ${vehicle.type.toLowerCase()} exterior and interior views, professional automotive 
      //  photography style, rotating 360-degree view, premium dealership quality`
      
      res.status(501).json({ 
        message: "Video generation available but not yet implemented in production", 
        note: "Contact admin to generate video using Gemini Veo 3.1",
        estimatedCost: "$0.90-$1.20",
        estimatedTime: "~60 seconds"
      });
    } catch (error) {
      console.error("Error generating video:", error);
      res.status(500).json({ error: "Failed to generate video" });
    }
  });

  // ===== VIEW TRACKING ROUTES =====
  
  // Track vehicle view (for remarketing)
  app.post("/api/vehicles/:id/view", async (req, res) => {
    try {
      const vehicleId = parseInt(req.params.id);
      const sessionId = req.body.sessionId || `session-${Date.now()}`;

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

  // ===== SCRAPER ROUTES =====
  
  // Manual trigger for inventory sync
  app.post("/api/scraper/sync", async (req, res) => {
    try {
      const result = await triggerManualSync();
      res.json(result);
    } catch (error) {
      console.error("Error triggering sync:", error);
      res.status(500).json({ error: "Failed to trigger sync" });
    }
  });

  // Test badge detection
  app.get("/api/scraper/test-badges", async (req, res) => {
    try {
      await testBadgeDetection();
      res.json({ message: "Check console for badge detection test results" });
    } catch (error) {
      console.error("Error testing badges:", error);
      res.status(500).json({ error: "Failed to test badges" });
    }
  });

  // ===== CHAT ROUTES =====
  
  // Chat endpoint for AI responses
  app.post("/api/chat", async (req, res) => {
    try {
      const { messages, vehicleContext } = req.body;

      if (!Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: "Messages array is required" });
      }

      // Validate message format
      for (const msg of messages) {
        if (!msg.role || !msg.content) {
          return res.status(400).json({ error: "Each message must have role and content" });
        }
        if (!["user", "assistant", "system"].includes(msg.role)) {
          return res.status(400).json({ error: "Invalid message role" });
        }
      }

      const response = await generateChatResponse(messages as ChatMessage[], vehicleContext);
      res.json({ message: response });
    } catch (error) {
      console.error("Error generating chat response:", error);
      res.status(500).json({ error: "Failed to generate chat response" });
    }
  });

  // ===== GOHIGHLEVEL CTA ROUTES =====
  
  // Handle CTA action (send lead to GoHighLevel)
  app.post("/api/cta/send", async (req, res) => {
    try {
      const { vehicleInfo, ctaType, contactInfo } = req.body;

      if (!vehicleInfo || !ctaType) {
        return res.status(400).json({ error: "vehicleInfo and ctaType are required" });
      }

      const validCTATypes = ['test-drive', 'reserve', 'get-approved', 'value-trade'];
      if (!validCTATypes.includes(ctaType)) {
        return res.status(400).json({ error: "Invalid CTA type" });
      }

      const { GHLClient } = await import("./ghl-client");
      const client = await GHLClient.getInstance();

      if (!client) {
        return res.status(503).json({ 
          error: "GoHighLevel integration not configured. Please configure in admin panel." 
        });
      }

      const result = await client.handleCTAAction(vehicleInfo, ctaType, contactInfo);

      if (!result.success) {
        return res.status(500).json({ 
          error: result.error || "Failed to send lead to GoHighLevel" 
        });
      }

      res.json(result);
    } catch (error) {
      console.error("Error handling CTA action:", error);
      res.status(500).json({ error: "Failed to process CTA action" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
