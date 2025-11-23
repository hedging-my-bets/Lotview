import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertVehicleSchema, insertVehicleViewSchema, insertFacebookPageSchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";
import { triggerManualSync } from "./scheduler";
import { testBadgeDetection } from "./scraper";
import { generateChatResponse, type ChatMessage } from "./openai";

// Simple admin authentication middleware
// NOTE: This is a basic demo implementation. For production, use proper session management with bcrypt.
const adminAuthMiddleware = (req: any, res: any, next: any) => {
  const adminToken = req.headers['x-admin-token'];
  
  // Simple token check - in production, use proper session management
  if (adminToken === 'admin123') {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized - Admin access required' });
  }
};

export async function registerRoutes(app: Express): Promise<Server> {
  
  // ===== ADMIN AUTH ROUTES =====
  
  // Admin login endpoint
  app.post("/api/admin/login", async (req, res) => {
    try {
      const { password } = req.body;
      
      // Simple password check - in production, use bcrypt and proper session management
      if (password === "admin123") {
        // Return token - in production, use JWT or session tokens
        res.json({ token: "admin123", success: true });
      } else {
        res.status(401).json({ error: "Invalid password", success: false });
      }
    } catch (error) {
      console.error("Error during admin login:", error);
      res.status(500).json({ error: "Login failed" });
    }
  });
  
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

  // Save conversation (public - conversations are saved automatically)
  app.post("/api/conversations", async (req, res) => {
    try {
      const { category, vehicleId, vehicleName, messages, sessionId } = req.body;

      if (!category || !messages || !sessionId) {
        return res.status(400).json({ error: "category, messages, and sessionId are required" });
      }

      const conversation = await storage.saveChatConversation({
        category,
        vehicleId: vehicleId || null,
        vehicleName: vehicleName || null,
        messages: JSON.stringify(messages),
        sessionId
      });

      res.json(conversation);
    } catch (error) {
      console.error("Error saving conversation:", error);
      res.status(500).json({ error: "Failed to save conversation" });
    }
  });

  // Get all conversations (with optional category filter) - ADMIN ONLY
  app.get("/api/conversations", adminAuthMiddleware, async (req, res) => {
    try {
      const category = req.query.category as string | undefined;
      const conversations = await storage.getAllConversations(category);
      
      // Parse messages JSON for each conversation
      const parsed = conversations.map(conv => ({
        ...conv,
        messages: JSON.parse(conv.messages)
      }));
      
      res.json(parsed);
    } catch (error) {
      console.error("Error fetching conversations:", error);
      res.status(500).json({ error: "Failed to fetch conversations" });
    }
  });

  // Get conversation by ID - ADMIN ONLY
  app.get("/api/conversations/:id", adminAuthMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const conversation = await storage.getConversationById(id);

      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      res.json({
        ...conversation,
        messages: JSON.parse(conversation.messages)
      });
    } catch (error) {
      console.error("Error fetching conversation:", error);
      res.status(500).json({ error: "Failed to fetch conversation" });
    }
  });

  // ===== CHAT PROMPT ROUTES =====

  // Get all chat prompts - ADMIN ONLY
  app.get("/api/chat-prompts", adminAuthMiddleware, async (req, res) => {
    try {
      const prompts = await storage.getChatPrompts();
      res.json(prompts);
    } catch (error) {
      console.error("Error fetching chat prompts:", error);
      res.status(500).json({ error: "Failed to fetch chat prompts" });
    }
  });

  // Get chat prompt by scenario - ADMIN ONLY
  app.get("/api/chat-prompts/:scenario", adminAuthMiddleware, async (req, res) => {
    try {
      const scenario = req.params.scenario;
      const prompt = await storage.getChatPromptByScenario(scenario);

      if (!prompt) {
        return res.status(404).json({ error: "Prompt not found for this scenario" });
      }

      res.json(prompt);
    } catch (error) {
      console.error("Error fetching chat prompt:", error);
      res.status(500).json({ error: "Failed to fetch chat prompt" });
    }
  });

  // Create or update chat prompt - ADMIN ONLY
  app.post("/api/chat-prompts", adminAuthMiddleware, async (req, res) => {
    try {
      const { scenario, systemPrompt, greeting } = req.body;

      if (!scenario || !systemPrompt || !greeting) {
        return res.status(400).json({ error: "scenario, systemPrompt, and greeting are required" });
      }

      // Check if prompt exists for this scenario
      const existing = await storage.getChatPromptByScenario(scenario);

      if (existing) {
        // Update existing
        const updated = await storage.updateChatPrompt(scenario, {
          systemPrompt,
          greeting,
          isActive: true,
        });
        res.json(updated);
      } else {
        // Create new
        const prompt = await storage.saveChatPrompt({
          scenario,
          systemPrompt,
          greeting,
          isActive: true,
        });
        res.json(prompt);
      }
    } catch (error) {
      console.error("Error saving chat prompt:", error);
      res.status(500).json({ error: "Failed to save chat prompt" });
    }
  });

  // Generate AI insights for conversations - ADMIN ONLY
  app.post("/api/chat-insights", adminAuthMiddleware, async (req, res) => {
    try {
      const { scenario } = req.body;

      if (!scenario) {
        return res.status(400).json({ error: "scenario is required" });
      }

      // Get conversations for this scenario
      const conversations = await storage.getAllConversations(scenario);

      if (conversations.length === 0) {
        return res.json({
          insights: "No conversations found for this scenario yet. Start collecting conversations to generate insights."
        });
      }

      // Get current prompt for context
      const currentPrompt = await storage.getChatPromptByScenario(scenario);

      // Prepare conversation data for analysis
      const conversationSummaries = conversations.slice(0, 20).map(conv => {
        const messages = JSON.parse(conv.messages);
        return {
          vehicleName: conv.vehicleName,
          messageCount: messages.length,
          messages: messages.map((m: any) => `${m.role}: ${m.content}`).join('\n')
        };
      });

      // Generate insights using OpenAI
      const analysisPrompt = `You are analyzing customer conversations for a car dealership's chatbot in the "${scenario}" scenario.

Current System Prompt: ${currentPrompt?.systemPrompt || 'Not set'}
Current Greeting: ${currentPrompt?.greeting || 'Not set'}

Here are ${conversationSummaries.length} recent conversations:

${conversationSummaries.map((conv, idx) => `
Conversation ${idx + 1} (${conv.vehicleName || 'General'}):
${conv.messages}
---
`).join('\n')}

Based on these conversations, provide:
1. Key patterns you notice in customer questions and concerns
2. Areas where the current prompts are working well
3. Specific improvements to the system prompt
4. Specific improvements to the greeting message
5. Common objections or friction points
6. Recommended follow-up questions the bot should ask

Format your response in clear sections with actionable recommendations.`;

      const response = await generateChatResponse(
        [{ role: 'user', content: analysisPrompt }],
        ''
      );

      res.json({ insights: response, conversationCount: conversations.length });
    } catch (error) {
      console.error("Error generating insights:", error);
      res.status(500).json({ error: "Failed to generate insights" });
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

  // ===== ADMIN ROUTES =====
  
  // Save GHL configuration
  app.post("/api/admin/ghl-config", async (req, res) => {
    try {
      const { apiKey, locationId } = req.body;

      if (!apiKey || !locationId) {
        return res.status(400).json({ error: "apiKey and locationId are required" });
      }

      const config = await storage.saveGHLConfig({ apiKey, locationId, isActive: true });
      res.json(config);
    } catch (error) {
      console.error("Error saving GHL config:", error);
      res.status(500).json({ error: "Failed to save GHL configuration" });
    }
  });

  // Save AI prompt template
  app.post("/api/admin/ai-prompt", async (req, res) => {
    try {
      const { name, promptText, isActive } = req.body;

      if (!name || !promptText) {
        return res.status(400).json({ error: "name and promptText are required" });
      }

      const template = await storage.saveAIPromptTemplate({ name, promptText, isActive });
      res.json(template);
    } catch (error) {
      console.error("Error saving AI prompt:", error);
      res.status(500).json({ error: "Failed to save AI prompt template" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
