import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertVehicleSchema, 
  insertVehicleViewSchema, 
  insertFacebookPageSchema,
  insertFacebookAccountSchema,
  insertAdTemplateSchema,
  insertPostingQueueSchema,
  insertPostingScheduleSchema
} from "@shared/schema";
import { fromZodError } from "zod-validation-error";
import { triggerManualSync } from "./scheduler";
import { testBadgeDetection } from "./scraper";
import { generateChatResponse, type ChatMessage } from "./openai";

import { authMiddleware, requireRole, generateToken, comparePassword, hashPassword, type AuthRequest } from "./auth";
import { facebookService } from "./facebook-service";
import crypto from "crypto";
import { decodeVIN } from "./vin-decoder";

// OAuth state store for CSRF protection (in production, use Redis or signed JWTs)
const oauthStateStore = new Map<string, { userId: number; accountId: number; expiresAt: number }>();

// Clean up expired states every hour
setInterval(() => {
  const now = Date.now();
  for (const [state, data] of Array.from(oauthStateStore.entries())) {
    if (data.expiresAt < now) {
      oauthStateStore.delete(state);
    }
  }
}, 3600000);

// DEPRECATED: Legacy admin authentication middleware
// WARNING: This is insecure and should only be used for backward compatibility in development
// In production, all admin routes should use JWT authentication
const LEGACY_ADMIN_ENABLED = process.env.LEGACY_ADMIN_ENABLED === "true" || process.env.NODE_ENV === "development";

const adminAuthMiddleware = (req: any, res: any, next: any) => {
  // Disable legacy auth in production for security
  if (!LEGACY_ADMIN_ENABLED) {
    return res.status(401).json({ error: 'Legacy admin authentication is disabled. Please use JWT authentication.' });
  }
  
  const adminToken = req.headers['x-admin-token'];
  
  // Simple token check - only for development/testing
  if (adminToken === 'admin123') {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized - Admin access required' });
  }
};

export async function registerRoutes(app: Express): Promise<Server> {
  
  // ===== AUTHENTICATION ROUTES (JWT) =====
  
  // Login endpoint (all user roles)
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }
      
      // Find user by email
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ error: "Invalid email or password" });
      }
      
      // Check if user is active
      if (!user.isActive) {
        return res.status(403).json({ error: "Account is deactivated" });
      }
      
      // Verify password
      const isValidPassword = await comparePassword(password, user.passwordHash);
      if (!isValidPassword) {
        return res.status(401).json({ error: "Invalid email or password" });
      }
      
      // Generate JWT token
      const token = generateToken(user);
      
      // Return user info and token (exclude password hash)
      const { passwordHash, ...userWithoutPassword } = user;
      res.json({ 
        token, 
        user: userWithoutPassword,
        success: true 
      });
    } catch (error) {
      console.error("Error during login:", error);
      res.status(500).json({ error: "Login failed" });
    }
  });
  
  // Get current user info (requires authentication)
  app.get("/api/auth/me", authMiddleware, async (req, res) => {
    try {
      const authReq = req as AuthRequest;
      const user = await storage.getUserById(authReq.user!.id);
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      const { passwordHash, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ error: "Failed to fetch user info" });
    }
  });
  
  // Logout endpoint (client-side token removal, but can be used for logging/analytics)
  app.post("/api/auth/logout", authMiddleware, async (req, res) => {
    try {
      const authReq = req as AuthRequest;
      // In a stateless JWT system, logout is primarily client-side (remove token)
      // This endpoint can be used for logging, analytics, or future token blacklisting
      console.log(`User ${authReq.user!.email} logged out at ${new Date().toISOString()}`);
      res.json({ success: true, message: "Logged out successfully" });
    } catch (error) {
      console.error("Error during logout:", error);
      res.status(500).json({ error: "Logout failed" });
    }
  });
  
  // ===== USER MANAGEMENT ROUTES (Master Only) =====
  
  // Get all users (master only)
  app.get("/api/users", authMiddleware, requireRole("master"), async (req, res) => {
    try {
      // TODO: Multi-tenant - Master users should see users from specific dealership or all dealerships
      // For now, show users from dealershipId=1
      const dealershipId = req.dealershipId!;
      const users = await storage.getAllUsers(dealershipId);
      // Exclude password hashes
      const usersWithoutPasswords = users.map(({ passwordHash, ...user }) => user);
      res.json(usersWithoutPasswords);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });
  
  // Create new user (master only)
  app.post("/api/users", authMiddleware, requireRole("master"), async (req, res) => {
    try {
      const authReq = req as AuthRequest;
      const { email, password, name, role } = req.body;
      
      if (!email || !password || !name || !role) {
        return res.status(400).json({ error: "Email, password, name, and role are required" });
      }
      
      // Validate role
      if (!["master", "manager", "salesperson"].includes(role)) {
        return res.status(400).json({ error: "Invalid role. Must be master, manager, or salesperson" });
      }
      
      // Check if email already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(409).json({ error: "User with this email already exists" });
      }
      
      // Hash password
      const passwordHash = await hashPassword(password);
      
      // TODO: Multi-tenant - Set dealershipId based on context or allow master to specify
      // For now, create users in dealershipId=1
      const dealershipId = role === "master" ? null : 1;
      
      // Create user
      const user = await storage.createUser({
        email,
        passwordHash,
        name,
        role,
        dealershipId,
        isActive: true,
        createdBy: authReq.user!.id,
      });
      
      // Return user without password hash
      const { passwordHash: _, ...userWithoutPassword } = user;
      res.status(201).json(userWithoutPassword);
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(500).json({ error: "Failed to create user" });
    }
  });
  
  // Update user (master only)
  app.patch("/api/users/:id", authMiddleware, requireRole("master"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { email, password, name, role, isActive } = req.body;
      
      const updates: any = {};
      if (email !== undefined) updates.email = email;
      if (name !== undefined) updates.name = name;
      if (role !== undefined) {
        if (!["master", "manager", "salesperson"].includes(role)) {
          return res.status(400).json({ error: "Invalid role" });
        }
        updates.role = role;
      }
      if (isActive !== undefined) updates.isActive = isActive;
      if (password) {
        updates.passwordHash = await hashPassword(password);
      }
      
      // TODO: Multi-tenant - Pass dealershipId for validation, or allow master to update any user
      // For now, pass undefined to allow master full access
      const user = await storage.updateUser(id, updates, undefined);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      const { passwordHash, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ error: "Failed to update user" });
    }
  });
  
  // ===== ADMIN AUTH ROUTES (LEGACY - for backward compatibility) =====
  
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
      // TODO: Multi-tenant - use req.dealershipId from subdomain when middleware is applied
      // For now, default to dealershipId = 1 for public vehicle listings
      const dealershipId = req.dealershipId!;
      const vehicles = await storage.getVehicles(dealershipId);
      
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
      // TODO: Multi-tenant - use req.dealershipId from subdomain when middleware is applied
      const dealershipId = req.dealershipId!;
      const vehicle = await storage.getVehicleById(id, dealershipId);
      
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

  // Create vehicle (master only)
  app.post("/api/vehicles", authMiddleware, requireRole("master"), async (req, res) => {
    try {
      const parsed = insertVehicleSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: fromZodError(parsed.error).message });
      }

      const dealershipId = req.dealershipId!;
      const vehicle = await storage.createVehicle({ ...parsed.data, dealershipId });
      res.status(201).json(vehicle);
    } catch (error) {
      console.error("Error creating vehicle:", error);
      res.status(500).json({ error: "Failed to create vehicle" });
    }
  });

  // Update vehicle (master only)
  app.patch("/api/vehicles/:id", authMiddleware, requireRole("master"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const parsed = insertVehicleSchema.partial().safeParse(req.body);
      
      if (!parsed.success) {
        return res.status(400).json({ error: fromZodError(parsed.error).message });
      }

      const dealershipId = req.dealershipId!;
      
      // SECURITY: Strip dealershipId from payload to prevent cross-tenant reassignment
      const { dealershipId: _removed, ...updateData } = parsed.data;
      
      const vehicle = await storage.updateVehicle(id, updateData, dealershipId);
      
      if (!vehicle) {
        return res.status(404).json({ error: "Vehicle not found" });
      }

      res.json(vehicle);
    } catch (error) {
      console.error("Error updating vehicle:", error);
      res.status(500).json({ error: "Failed to update vehicle" });
    }
  });

  // Delete vehicle (master only)
  app.delete("/api/vehicles/:id", authMiddleware, requireRole("master"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      // TODO: Multi-tenant - use req.dealershipId from auth when middleware is applied
      const dealershipId = req.dealershipId!;
      await storage.deleteVehicle(id, dealershipId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting vehicle:", error);
      res.status(500).json({ error: "Failed to delete vehicle" });
    }
  });

  // Generate video for vehicle using Gemini Veo (master only)
  app.post("/api/vehicles/:id/generate-video", authMiddleware, requireRole("master"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      // TODO: Multi-tenant - use req.dealershipId from auth when middleware is applied
      const dealershipId = req.dealershipId!;
      const vehicle = await storage.getVehicleById(id, dealershipId);
      
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
      // TODO: Multi-tenant - get dealershipId from vehicle record
      const dealershipId = req.dealershipId!;

      const view = await storage.trackVehicleView({
        vehicleId,
        sessionId,
        dealershipId
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
      // TODO: Multi-tenant - get dealershipId from vehicle record
      const dealershipId = req.dealershipId!;
      
      const count = await storage.getVehicleViews(vehicleId, dealershipId, hours);
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

      // TODO: Multi-tenant - get dealershipId from vehicle or context
      const dealershipId = req.dealershipId!;

      const conversation = await storage.saveChatConversation({
        dealershipId,
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
  app.get("/api/conversations", authMiddleware, requireRole("master"), async (req, res) => {
    try {
      // TODO: Multi-tenant - use req.dealershipId when middleware is applied
      const dealershipId = req.dealershipId!;
      const category = req.query.category as string | undefined;
      const conversations = await storage.getAllConversations(dealershipId, category);
      
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
  app.get("/api/conversations/:id", authMiddleware, requireRole("master"), async (req, res) => {
    try {
      // TODO: Multi-tenant - use req.dealershipId when middleware is applied
      const dealershipId = req.dealershipId!;
      const id = parseInt(req.params.id);
      const conversation = await storage.getConversationById(id, dealershipId);

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
  app.get("/api/chat-prompts", authMiddleware, requireRole("master"), async (req, res) => {
    try {
      // TODO: Multi-tenant - use req.dealershipId when middleware is applied
      const dealershipId = req.dealershipId!;
      const prompts = await storage.getChatPrompts(dealershipId);
      res.json(prompts);
    } catch (error) {
      console.error("Error fetching chat prompts:", error);
      res.status(500).json({ error: "Failed to fetch chat prompts" });
    }
  });

  // Get chat prompt by scenario - ADMIN ONLY
  app.get("/api/chat-prompts/:scenario", authMiddleware, requireRole("master"), async (req, res) => {
    try {
      // TODO: Multi-tenant - use req.dealershipId when middleware is applied
      const dealershipId = req.dealershipId!;
      const scenario = req.params.scenario;
      const prompt = await storage.getChatPromptByScenario(scenario, dealershipId);

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
  app.post("/api/chat-prompts", authMiddleware, requireRole("master"), async (req, res) => {
    try {
      // TODO: Multi-tenant - use req.dealershipId when middleware is applied
      const dealershipId = req.dealershipId!;
      const { scenario, systemPrompt, greeting } = req.body;

      if (!scenario || !systemPrompt || !greeting) {
        return res.status(400).json({ error: "scenario, systemPrompt, and greeting are required" });
      }

      // Check if prompt exists for this scenario
      const existing = await storage.getChatPromptByScenario(scenario, dealershipId);

      if (existing) {
        // Update existing
        const updated = await storage.updateChatPrompt(scenario, dealershipId, {
          systemPrompt,
          greeting,
          isActive: true,
        });
        res.json(updated);
      } else {
        // Create new
        const prompt = await storage.saveChatPrompt({
          dealershipId,
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
  app.post("/api/chat-insights", authMiddleware, requireRole("master"), async (req, res) => {
    try {
      // TODO: Multi-tenant - use req.dealershipId when middleware is applied
      const dealershipId = req.dealershipId!;
      const { scenario } = req.body;

      if (!scenario) {
        return res.status(400).json({ error: "scenario is required" });
      }

      // Get conversations for this scenario
      const conversations = await storage.getAllConversations(dealershipId, scenario);

      if (conversations.length === 0) {
        return res.json({
          insights: "No conversations found for this scenario yet. Start collecting conversations to generate insights."
        });
      }

      // Get current prompt for context
      const currentPrompt = await storage.getChatPromptByScenario(scenario, dealershipId);

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

  // ===== SMS HANDOFF ROUTES =====
  
  // Request SMS handoff (send conversation to GHL webhook) - PUBLIC (user initiates)
  app.post("/api/chat/handoff", async (req, res) => {
    try {
      const { conversationId, phoneNumber, messages, vehicleInfo, category } = req.body;

      if (!conversationId || !phoneNumber || !messages) {
        return res.status(400).json({ error: "conversationId, phoneNumber, and messages are required" });
      }

      // TODO: Multi-tenant - get dealershipId from conversation or context
      const dealershipId = req.dealershipId!;

      // Get active webhook config
      const webhookConfig = await storage.getActiveGHLWebhookConfig(dealershipId);

      if (!webhookConfig) {
        return res.status(503).json({ 
          error: "SMS handoff not configured. Please configure GHL webhook in admin panel." 
        });
      }

      // Format conversation summary for GHL
      const conversationSummary = messages.map((m: any) => 
        `${m.role === 'assistant' ? 'Bot' : 'Customer'}: ${m.content}`
      ).join('\n\n');

      const payload = {
        phone: phoneNumber,
        conversationSummary,
        category: category || 'general',
        vehicleInfo: vehicleInfo || null,
        timestamp: new Date().toISOString(),
        source: 'olympic-auto-website'
      };

      // Send to GHL webhook
      const response = await fetch(webhookConfig.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Webhook failed with status ${response.status}`);
      }

      // Update conversation with handoff status
      await storage.updateConversationHandoff(conversationId, dealershipId, {
        handoffRequested: true,
        handoffPhone: phoneNumber,
        handoffSent: true,
        handoffSentAt: new Date(),
      });

      res.json({ 
        success: true, 
        message: "Conversation handed off to SMS. You'll receive a text shortly!" 
      });
    } catch (error) {
      console.error("Error handling SMS handoff:", error);
      
      // Update conversation with failed handoff attempt
      if (req.body.conversationId) {
        // TODO: Multi-tenant - get dealershipId from conversation or context
        const dealershipId = req.dealershipId!;
        await storage.updateConversationHandoff(req.body.conversationId, dealershipId, {
          handoffRequested: true,
          handoffPhone: req.body.phoneNumber,
          handoffSent: false,
        });
      }
      
      res.status(500).json({ error: "Failed to handoff conversation to SMS" });
    }
  });

  // ===== FINANCING RULES ROUTES (Master Only) =====
  
  // Get all credit score tiers
  app.get("/api/financing/credit-tiers", authMiddleware, requireRole("master"), async (req, res) => {
    try {
      // TODO: Multi-tenant - use req.dealershipId when middleware is applied
      const dealershipId = req.dealershipId!;
      const tiers = await storage.getCreditScoreTiers(dealershipId);
      res.json(tiers);
    } catch (error) {
      console.error("Error fetching credit tiers:", error);
      res.status(500).json({ error: "Failed to fetch credit tiers" });
    }
  });
  
  // Create credit score tier
  app.post("/api/financing/credit-tiers", authMiddleware, requireRole("master"), async (req, res) => {
    try {
      const { tierName, minScore, maxScore, interestRate } = req.body;
      
      if (!tierName || minScore === undefined || maxScore === undefined || interestRate === undefined) {
        return res.status(400).json({ error: "All fields are required" });
      }
      
      if (minScore > maxScore) {
        return res.status(400).json({ error: "Min score must be less than or equal to max score" });
      }
      
      if (minScore < 300 || maxScore > 850) {
        return res.status(400).json({ error: "Credit scores must be between 300 and 850" });
      }
      
      if (interestRate < 0 || interestRate > 100) {
        return res.status(400).json({ error: "Interest rate must be between 0 and 100" });
      }
      
      // TODO: Multi-tenant - use req.dealershipId when middleware is applied
      const dealershipId = req.dealershipId!;
      const tier = await storage.createCreditScoreTier({
        dealershipId,
        tierName,
        minScore,
        maxScore,
        interestRate,
        isActive: true,
      });
      
      res.status(201).json(tier);
    } catch (error) {
      console.error("Error creating credit tier:", error);
      res.status(500).json({ error: "Failed to create credit tier" });
    }
  });
  
  // Update credit score tier
  app.patch("/api/financing/credit-tiers/:id", authMiddleware, requireRole("master"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { minScore, maxScore, interestRate } = req.body;
      
      if (minScore !== undefined && maxScore !== undefined && minScore > maxScore) {
        return res.status(400).json({ error: "Min score must be less than or equal to max score" });
      }
      
      if (minScore !== undefined && (minScore < 300 || minScore > 850)) {
        return res.status(400).json({ error: "Min score must be between 300 and 850" });
      }
      
      if (maxScore !== undefined && (maxScore < 300 || maxScore > 850)) {
        return res.status(400).json({ error: "Max score must be between 300 and 850" });
      }
      
      if (interestRate !== undefined && (interestRate < 0 || interestRate > 100)) {
        return res.status(400).json({ error: "Interest rate must be between 0 and 100" });
      }
      
      // TODO: Multi-tenant - use req.dealershipId when middleware is applied
      const dealershipId = req.dealershipId!;
      const tier = await storage.updateCreditScoreTier(id, dealershipId, req.body);
      
      if (!tier) {
        return res.status(404).json({ error: "Credit tier not found" });
      }
      
      res.json(tier);
    } catch (error) {
      console.error("Error updating credit tier:", error);
      res.status(500).json({ error: "Failed to update credit tier" });
    }
  });
  
  // Delete credit score tier
  app.delete("/api/financing/credit-tiers/:id", authMiddleware, requireRole("master"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      // TODO: Multi-tenant - use req.dealershipId when middleware is applied
      const dealershipId = req.dealershipId!;
      await storage.deleteCreditScoreTier(id, dealershipId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting credit tier:", error);
      res.status(500).json({ error: "Failed to delete credit tier" });
    }
  });
  
  // Get all model year terms
  app.get("/api/financing/model-year-terms", authMiddleware, requireRole("master"), async (req, res) => {
    try {
      // TODO: Multi-tenant - use req.dealershipId when middleware is applied
      const dealershipId = req.dealershipId!;
      const terms = await storage.getModelYearTerms(dealershipId);
      res.json(terms);
    } catch (error) {
      console.error("Error fetching model year terms:", error);
      res.status(500).json({ error: "Failed to fetch model year terms" });
    }
  });
  
  // Create model year term
  app.post("/api/financing/model-year-terms", authMiddleware, requireRole("master"), async (req, res) => {
    try {
      const { minModelYear, maxModelYear, availableTerms } = req.body;
      
      if (!minModelYear || !maxModelYear || !availableTerms) {
        return res.status(400).json({ error: "All fields are required" });
      }
      
      if (minModelYear > maxModelYear) {
        return res.status(400).json({ error: "Min year must be less than or equal to max year" });
      }
      
      if (!Array.isArray(availableTerms) || availableTerms.length === 0) {
        return res.status(400).json({ error: "At least one term must be selected" });
      }
      
      const validTerms = ["36", "48", "60", "72", "84"];
      if (!availableTerms.every(term => validTerms.includes(term))) {
        return res.status(400).json({ error: "Invalid term selected" });
      }
      
      // TODO: Multi-tenant - use req.dealershipId when middleware is applied
      const dealershipId = req.dealershipId!;
      const term = await storage.createModelYearTerm({
        dealershipId,
        minModelYear,
        maxModelYear,
        availableTerms,
        isActive: true,
      });
      
      res.status(201).json(term);
    } catch (error) {
      console.error("Error creating model year term:", error);
      res.status(500).json({ error: "Failed to create model year term" });
    }
  });
  
  // Update model year term
  app.patch("/api/financing/model-year-terms/:id", authMiddleware, requireRole("master"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { minModelYear, maxModelYear, availableTerms } = req.body;
      
      if (minModelYear !== undefined && maxModelYear !== undefined && minModelYear > maxModelYear) {
        return res.status(400).json({ error: "Min year must be less than or equal to max year" });
      }
      
      if (availableTerms !== undefined) {
        if (!Array.isArray(availableTerms) || availableTerms.length === 0) {
          return res.status(400).json({ error: "At least one term must be selected" });
        }
        
        const validTerms = ["36", "48", "60", "72", "84"];
        if (!availableTerms.every(term => validTerms.includes(term))) {
          return res.status(400).json({ error: "Invalid term selected" });
        }
      }
      
      // TODO: Multi-tenant - use req.dealershipId when middleware is applied
      const dealershipId = req.dealershipId!;
      const term = await storage.updateModelYearTerm(id, dealershipId, req.body);
      
      if (!term) {
        return res.status(404).json({ error: "Model year term not found" });
      }
      
      res.json(term);
    } catch (error) {
      console.error("Error updating model year term:", error);
      res.status(500).json({ error: "Failed to update model year term" });
    }
  });
  
  // Delete model year term
  app.delete("/api/financing/model-year-terms/:id", authMiddleware, requireRole("master"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      // TODO: Multi-tenant - use req.dealershipId when middleware is applied
      const dealershipId = req.dealershipId!;
      await storage.deleteModelYearTerm(id, dealershipId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting model year term:", error);
      res.status(500).json({ error: "Failed to delete model year term" });
    }
  });
  
  // ===== FACEBOOK POSTING ROUTES (Salespeople) =====
  
  // Get Facebook accounts for current user
  app.get("/api/facebook/accounts", authMiddleware, requireRole("salesperson"), async (req, res) => {
    try {
      const authReq = req as AuthRequest;
      const userId = authReq.user!.id;
      // TODO: Multi-tenant - use req.dealershipId when middleware is applied
      const dealershipId = req.dealershipId!;
      const accounts = await storage.getFacebookAccountsByUser(userId, dealershipId);
      res.json(accounts);
    } catch (error) {
      console.error("Error fetching Facebook accounts:", error);
      res.status(500).json({ error: "Failed to fetch Facebook accounts" });
    }
  });

  // Create Facebook account
  app.post("/api/facebook/accounts", authMiddleware, requireRole("salesperson"), async (req, res) => {
    try {
      const authReq = req as AuthRequest;
      const userId = authReq.user!.id;
      // TODO: Multi-tenant - use req.dealershipId when middleware is applied
      const dealershipId = req.dealershipId!;
      
      // Validate request body
      const validated = insertFacebookAccountSchema.omit({ userId: true, isActive: true }).safeParse(req.body);
      if (!validated.success) {
        return res.status(400).json({ error: fromZodError(validated.error).message });
      }

      // Check if user already has 5 accounts
      const existingAccounts = await storage.getFacebookAccountsByUser(userId, dealershipId);
      if (existingAccounts.length >= 5) {
        return res.status(400).json({ error: "Maximum 5 Facebook accounts per user" });
      }
      
      const account = await storage.createFacebookAccount({
        ...validated.data,
        userId,
        dealershipId,
        isActive: true,
      });
      
      res.status(201).json(account);
    } catch (error) {
      console.error("Error creating Facebook account:", error);
      res.status(500).json({ error: "Failed to create Facebook account" });
    }
  });

  // Update Facebook account
  app.patch("/api/facebook/accounts/:id", authMiddleware, requireRole("salesperson"), async (req, res) => {
    try {
      const authReq = req as AuthRequest;
      const id = parseInt(req.params.id);
      const userId = authReq.user!.id;
      // TODO: Multi-tenant - use req.dealershipId when middleware is applied
      const dealershipId = req.dealershipId!;
      
      // Validate with partial schema, excluding ownership fields
      const updateSchema = insertFacebookAccountSchema.omit({ userId: true }).partial();
      const validated = updateSchema.safeParse(req.body);
      if (!validated.success) {
        return res.status(400).json({ error: fromZodError(validated.error).message });
      }
      
      const account = await storage.updateFacebookAccount(id, userId, dealershipId, validated.data);
      
      if (!account) {
        return res.status(404).json({ error: "Facebook account not found or access denied" });
      }
      
      res.json(account);
    } catch (error) {
      console.error("Error updating Facebook account:", error);
      res.status(500).json({ error: "Failed to update Facebook account" });
    }
  });

  // Delete Facebook account
  app.delete("/api/facebook/accounts/:id", authMiddleware, requireRole("salesperson"), async (req, res) => {
    try {
      const authReq = req as AuthRequest;
      const id = parseInt(req.params.id);
      const userId = authReq.user!.id;
      // TODO: Multi-tenant - use req.dealershipId when middleware is applied
      const dealershipId = req.dealershipId!;
      
      const success = await storage.deleteFacebookAccount(id, userId, dealershipId);
      
      if (!success) {
        return res.status(404).json({ error: "Facebook account not found or access denied" });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting Facebook account:", error);
      res.status(500).json({ error: "Failed to delete Facebook account" });
    }
  });

  // Get ad templates for current user
  app.get("/api/facebook/templates", authMiddleware, requireRole("salesperson"), async (req, res) => {
    try {
      const authReq = req as AuthRequest;
      const userId = authReq.user!.id;
      // TODO: Multi-tenant - use req.dealershipId when middleware is applied
      const dealershipId = req.dealershipId!;
      const templates = await storage.getAdTemplatesByUser(userId, dealershipId);
      res.json(templates);
    } catch (error) {
      console.error("Error fetching ad templates:", error);
      res.status(500).json({ error: "Failed to fetch ad templates" });
    }
  });

  // Create ad template
  app.post("/api/facebook/templates", authMiddleware, requireRole("salesperson"), async (req, res) => {
    try {
      const authReq = req as AuthRequest;
      const userId = authReq.user!.id;
      // TODO: Multi-tenant - use req.dealershipId when middleware is applied
      const dealershipId = req.dealershipId!;
      
      // Validate request body
      const validated = insertAdTemplateSchema.omit({ userId: true }).safeParse(req.body);
      if (!validated.success) {
        return res.status(400).json({ error: fromZodError(validated.error).message });
      }
      
      const template = await storage.createAdTemplate({
        ...validated.data,
        userId,
        dealershipId,
      });
      
      res.status(201).json(template);
    } catch (error) {
      console.error("Error creating ad template:", error);
      res.status(500).json({ error: "Failed to create ad template" });
    }
  });

  // Update ad template
  app.patch("/api/facebook/templates/:id", authMiddleware, requireRole("salesperson"), async (req, res) => {
    try {
      const authReq = req as AuthRequest;
      const id = parseInt(req.params.id);
      const userId = authReq.user!.id;
      // TODO: Multi-tenant - use req.dealershipId when middleware is applied
      const dealershipId = req.dealershipId!;
      
      // Validate with partial schema, excluding ownership fields
      const updateSchema = insertAdTemplateSchema.omit({ userId: true }).partial();
      const validated = updateSchema.safeParse(req.body);
      if (!validated.success) {
        return res.status(400).json({ error: fromZodError(validated.error).message });
      }
      
      const template = await storage.updateAdTemplate(id, userId, dealershipId, validated.data);
      
      if (!template) {
        return res.status(404).json({ error: "Template not found or access denied" });
      }
      
      res.json(template);
    } catch (error) {
      console.error("Error updating ad template:", error);
      res.status(500).json({ error: "Failed to update ad template" });
    }
  });

  // Delete ad template
  app.delete("/api/facebook/templates/:id", authMiddleware, requireRole("salesperson"), async (req, res) => {
    try {
      const authReq = req as AuthRequest;
      const id = parseInt(req.params.id);
      const userId = authReq.user!.id;
      // TODO: Multi-tenant - use req.dealershipId when middleware is applied
      const dealershipId = req.dealershipId!;
      
      const success = await storage.deleteAdTemplate(id, userId, dealershipId);
      
      if (!success) {
        return res.status(404).json({ error: "Template not found or access denied" });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting ad template:", error);
      res.status(500).json({ error: "Failed to delete ad template" });
    }
  });

  // Get posting queue for current user
  app.get("/api/facebook/queue", authMiddleware, requireRole("salesperson"), async (req, res) => {
    try {
      const authReq = req as AuthRequest;
      const userId = authReq.user!.id;
      // TODO: Multi-tenant - use req.dealershipId when middleware is applied
      const dealershipId = req.dealershipId!;
      const queue = await storage.getPostingQueueByUser(userId, dealershipId);
      res.json(queue);
    } catch (error) {
      console.error("Error fetching posting queue:", error);
      res.status(500).json({ error: "Failed to fetch posting queue" });
    }
  });

  // Add vehicle to posting queue
  app.post("/api/facebook/queue", authMiddleware, requireRole("salesperson"), async (req, res) => {
    try {
      const authReq = req as AuthRequest;
      const userId = authReq.user!.id;
      // TODO: Multi-tenant - use req.dealershipId when middleware is applied
      const dealershipId = req.dealershipId!;
      
      // Validate request body
      const validated = insertPostingQueueSchema.omit({ userId: true, status: true }).safeParse(req.body);
      if (!validated.success) {
        return res.status(400).json({ error: fromZodError(validated.error).message });
      }
      
      // Verify ownership of foreign key references
      if (validated.data.facebookAccountId) {
        const account = await storage.getFacebookAccountById(validated.data.facebookAccountId, userId, dealershipId);
        if (!account || account.userId !== userId) {
          return res.status(403).json({ error: "Facebook account not found or access denied" });
        }
      }
      
      if (validated.data.templateId) {
        const template = await storage.getAdTemplateById(validated.data.templateId, userId, dealershipId);
        if (!template || template.userId !== userId) {
          return res.status(403).json({ error: "Ad template not found or access denied" });
        }
      }
      
      const item = await storage.createPostingQueueItem({
        ...validated.data,
        userId,
        dealershipId,
        status: 'queued',
      });
      
      res.status(201).json(item);
    } catch (error) {
      console.error("Error adding to posting queue:", error);
      res.status(500).json({ error: "Failed to add to posting queue" });
    }
  });

  // Update queue item
  app.patch("/api/facebook/queue/:id", authMiddleware, requireRole("salesperson"), async (req, res) => {
    try {
      const authReq = req as AuthRequest;
      const id = parseInt(req.params.id);
      const userId = authReq.user!.id;
      // TODO: Multi-tenant - use req.dealershipId when middleware is applied
      const dealershipId = req.dealershipId!;
      
      // Validate with partial schema, excluding ownership and status fields
      const updateSchema = insertPostingQueueSchema.omit({ userId: true, status: true }).partial();
      const validated = updateSchema.safeParse(req.body);
      if (!validated.success) {
        return res.status(400).json({ error: fromZodError(validated.error).message });
      }
      
      // Verify ownership of foreign key references if being updated
      if (validated.data.facebookAccountId) {
        const account = await storage.getFacebookAccountById(validated.data.facebookAccountId, userId, dealershipId);
        if (!account || account.userId !== userId) {
          return res.status(403).json({ error: "Facebook account not found or access denied" });
        }
      }
      
      if (validated.data.templateId) {
        const template = await storage.getAdTemplateById(validated.data.templateId, userId, dealershipId);
        if (!template || template.userId !== userId) {
          return res.status(403).json({ error: "Ad template not found or access denied" });
        }
      }
      
      const item = await storage.updatePostingQueueItem(id, userId, dealershipId, validated.data);
      
      if (!item) {
        return res.status(404).json({ error: "Queue item not found or access denied" });
      }
      
      res.json(item);
    } catch (error) {
      console.error("Error updating queue item:", error);
      res.status(500).json({ error: "Failed to update queue item" });
    }
  });

  // Delete queue item
  app.delete("/api/facebook/queue/:id", authMiddleware, requireRole("salesperson"), async (req, res) => {
    try {
      const authReq = req as AuthRequest;
      const id = parseInt(req.params.id);
      const userId = authReq.user!.id;
      // TODO: Multi-tenant - use req.dealershipId when middleware is applied
      const dealershipId = req.dealershipId!;
      
      const success = await storage.deletePostingQueueItem(id, userId, dealershipId);
      
      if (!success) {
        return res.status(404).json({ error: "Queue item not found or access denied" });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting queue item:", error);
      res.status(500).json({ error: "Failed to delete queue item" });
    }
  });

  // Get posting schedule for current user
  app.get("/api/facebook/schedule", authMiddleware, requireRole("salesperson"), async (req, res) => {
    try {
      const authReq = req as AuthRequest;
      const userId = authReq.user!.id;
      // TODO: Multi-tenant - use req.dealershipId when middleware is applied
      const dealershipId = req.dealershipId!;
      const schedule = await storage.getPostingScheduleByUser(userId, dealershipId);
      res.json(schedule || null);
    } catch (error) {
      console.error("Error fetching posting schedule:", error);
      res.status(500).json({ error: "Failed to fetch posting schedule" });
    }
  });

  // Create or update posting schedule
  app.post("/api/facebook/schedule", authMiddleware, requireRole("salesperson"), async (req, res) => {
    try {
      const authReq = req as AuthRequest;
      const userId = authReq.user!.id;
      // TODO: Multi-tenant - use req.dealershipId when middleware is applied
      const dealershipId = req.dealershipId!;
      
      // Validate request body
      const validated = insertPostingScheduleSchema.omit({ userId: true }).safeParse(req.body);
      if (!validated.success) {
        return res.status(400).json({ error: fromZodError(validated.error).message });
      }
      
      // Check if schedule exists
      const existing = await storage.getPostingScheduleByUser(userId, dealershipId);
      
      let schedule;
      if (existing) {
        schedule = await storage.updatePostingSchedule(userId, dealershipId, validated.data);
      } else {
        schedule = await storage.createPostingSchedule({
          ...validated.data,
          userId,
          dealershipId,
        });
      }
      
      res.json(schedule);
    } catch (error) {
      console.error("Error saving posting schedule:", error);
      res.status(500).json({ error: "Failed to save posting schedule" });
    }
  });

  // Check if Facebook is configured
  app.get("/api/facebook/config/status", authMiddleware, requireRole("salesperson"), (req, res) => {
    res.json({ configured: facebookService.isConfigured() });
  });

  // Initiate Facebook OAuth flow
  app.get("/api/facebook/oauth/init/:accountId", authMiddleware, requireRole("salesperson"), async (req, res) => {
    try {
      const authReq = req as AuthRequest;
      const accountId = parseInt(req.params.accountId);
      const userId = authReq.user!.id;
      // TODO: Multi-tenant - use req.dealershipId when middleware is applied
      const dealershipId = req.dealershipId!;
      
      const account = await storage.getFacebookAccountById(accountId, userId, dealershipId);
      if (!account || account.userId !== userId) {
        return res.status(404).json({ error: "Account not found or access denied" });
      }
      
      const state = crypto.randomBytes(32).toString('hex');
      oauthStateStore.set(state, {
        userId,
        accountId,
        expiresAt: Date.now() + 600000
      });
      
      const authUrl = facebookService.getAuthUrl(state);
      res.json({ authUrl });
    } catch (error) {
      console.error("Error initiating OAuth:", error);
      res.status(500).json({ error: "Failed to initiate OAuth flow" });
    }
  });

  // Facebook OAuth callback
  app.get("/api/facebook/oauth/callback", async (req, res) => {
    try {
      const { code, state } = req.query;
      
      if (!code || !state) {
        return res.status(400).send("Missing code or state");
      }

      const stateData = oauthStateStore.get(state as string);
      if (!stateData) {
        return res.status(400).send(`
          <html>
            <head><title>Invalid State</title></head>
            <body style="font-family: system-ui; text-align: center; padding: 50px;">
              <h1>✗ Invalid or Expired Session</h1>
              <p>The authentication session is invalid or has expired. Please try again.</p>
              <button onclick="window.close()">Close</button>
            </body>
          </html>
        `);
      }

      if (stateData.expiresAt < Date.now()) {
        oauthStateStore.delete(state as string);
        return res.status(400).send(`
          <html>
            <head><title>Session Expired</title></head>
            <body style="font-family: system-ui; text-align: center; padding: 50px;">
              <h1>✗ Session Expired</h1>
              <p>The authentication session has expired. Please try again.</p>
              <button onclick="window.close()">Close</button>
            </body>
          </html>
        `);
      }

      oauthStateStore.delete(state as string);

      const { accountId, userId } = stateData;
      
      // TODO: Multi-tenant - need dealershipId from stateData for OAuth callback
      const dealershipId = req.dealershipId!;
      const account = await storage.getFacebookAccountById(accountId, userId, dealershipId);
      if (!account) {
        return res.status(403).send(`
          <html>
            <head><title>Access Denied</title></head>
            <body style="font-family: system-ui; text-align: center; padding: 50px;">
              <h1>✗ Access Denied</h1>
              <p>You don't have permission to connect this account.</p>
              <button onclick="window.close()">Close</button>
            </body>
          </html>
        `);
      }
      
      const { accessToken } = await facebookService.exchangeCodeForToken(code as string);
      const longLivedToken = await facebookService.getLongLivedToken(accessToken);
      const userInfo = await facebookService.getUserInfo(longLivedToken.accessToken);
      
      const expiresAt = new Date(Date.now() + longLivedToken.expiresIn * 1000);
      
      await storage.updateFacebookAccount(accountId, userId, dealershipId, {
        accessToken: longLivedToken.accessToken,
        facebookUserId: userInfo.id,
        tokenExpiresAt: expiresAt,
        isActive: true
      });
      
      res.send(`
        <html>
          <head><title>Facebook Connected</title></head>
          <body style="font-family: system-ui; text-align: center; padding: 50px;">
            <h1>✓ Facebook Account Connected</h1>
            <p>You can close this window and return to the app.</p>
            <script>window.close();</script>
          </body>
        </html>
      `);
    } catch (error) {
      console.error("OAuth callback error:", error);
      res.status(500).send(`
        <html>
          <head><title>Connection Failed</title></head>
          <body style="font-family: system-ui; text-align: center; padding: 50px;">
            <h1>✗ Connection Failed</h1>
            <p>${error instanceof Error ? error.message : "Unknown error"}</p>
            <button onclick="window.close()">Close</button>
          </body>
        </html>
      `);
    }
  });

  // Manually post a vehicle to Facebook Marketplace
  app.post("/api/facebook/post/:queueId", authMiddleware, requireRole("salesperson"), async (req, res) => {
    try {
      const authReq = req as AuthRequest;
      const queueId = parseInt(req.params.queueId);
      const userId = authReq.user!.id;
      // TODO: Multi-tenant - use req.dealershipId when middleware is applied
      const dealershipId = req.dealershipId!;
      
      const queueItem = (await storage.getPostingQueueByUser(userId, dealershipId)).find(item => item.id === queueId);
      
      if (!queueItem) {
        return res.status(404).json({ error: "Queue item not found" });
      }
      
      const vehicle = await storage.getVehicleById(queueItem.vehicleId, dealershipId);
      if (!vehicle) {
        return res.status(404).json({ error: "Vehicle not found" });
      }
      
      let account;
      if (queueItem.facebookAccountId) {
        account = await storage.getFacebookAccountById(queueItem.facebookAccountId, userId, dealershipId);
      } else {
        const accounts = await storage.getFacebookAccountsByUser(userId, dealershipId);
        account = accounts[0];
      }
      
      if (!account || !account.accessToken) {
        return res.status(400).json({ error: "No Facebook account connected" });
      }
      
      let template;
      if (queueItem.templateId) {
        template = await storage.getAdTemplateById(queueItem.templateId, userId, dealershipId);
      } else {
        const templates = await storage.getAdTemplatesByUser(userId, dealershipId);
        template = templates.find(t => t.isDefault) || templates[0];
      }
      
      if (!template) {
        return res.status(400).json({ error: "No ad template found" });
      }
      
      await storage.updatePostingQueueItem(queueId, userId, dealershipId, { status: 'posting' });
      
      try {
        const { postId } = await facebookService.postToMarketplace(
          account.accessToken,
          vehicle,
          {
            titleTemplate: template.titleTemplate,
            descriptionTemplate: template.descriptionTemplate
          }
        );
        
        await storage.updatePostingQueueItem(queueId, userId, dealershipId, {
          status: 'posted',
          facebookPostId: postId,
          postedAt: new Date()
        });
        
        res.json({ success: true, postId });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        await storage.updatePostingQueueItem(queueId, userId, dealershipId, {
          status: 'failed',
          errorMessage
        });
        throw error;
      }
    } catch (error) {
      console.error("Error posting to Facebook:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to post to Facebook" });
    }
  });

  // ===== SALES MANAGER ROUTES =====
  
  // Decode VIN
  app.post("/api/manager/decode-vin", authMiddleware, requireRole("manager"), async (req, res) => {
    try {
      const { vin } = req.body;
      
      if (!vin || typeof vin !== 'string') {
        return res.json({
          vin: '',
          errorCode: 'MISSING_VIN',
          errorMessage: 'VIN is required'
        });
      }
      
      const result = await decodeVIN(vin);
      res.json(result);
    } catch (error) {
      console.error("Error decoding VIN:", error);
      res.json({
        vin: req.body.vin || '',
        errorCode: 'DECODE_ERROR',
        errorMessage: error instanceof Error ? error.message : "Failed to decode VIN"
      });
    }
  });

  // Market pricing analysis (uses external market listings)
  app.post("/api/manager/market-pricing", authMiddleware, requireRole("manager"), async (req, res) => {
    try {
      const { year, years, make, model, trim, trims, yearMin, yearMax, mileage, radiusKm, postalCode } = req.body;
      
      // Validate required fields
      if (!year && !years && !yearMin) {
        return res.status(400).json({
          error: 'Missing required fields',
          message: 'Year or year range is required'
        });
      }
      
      if (!make || !model) {
        return res.status(400).json({
          error: 'Missing required fields',
          message: 'Make and model are required for market pricing analysis'
        });
      }

      // Get user settings for postal code/radius defaults
      const authReq = req as AuthRequest;
      const userId = authReq.user!.id;
      // TODO: Multi-tenant - use req.dealershipId when middleware is applied
      const dealershipId = req.dealershipId!;
      const userSettings = await storage.getManagerSettings(userId, dealershipId);
      
      const searchPostalCode = postalCode || userSettings?.postalCode;
      const searchRadiusKm = radiusKm || userSettings?.defaultRadiusKm || 50;
      
      // Handle years parameter (array) vs single year vs year range
      let searchYearMin: number;
      let searchYearMax: number;
      let targetYear: number;
      if (years && Array.isArray(years) && years.length > 0) {
        searchYearMin = Math.min(...years);
        searchYearMax = Math.max(...years);
        targetYear = Math.round((searchYearMin + searchYearMax) / 2);
      } else if (yearMin && yearMax) {
        searchYearMin = parseInt(yearMin);
        searchYearMax = parseInt(yearMax);
        targetYear = Math.round((searchYearMin + searchYearMax) / 2);
      } else if (year) {
        targetYear = parseInt(year);
        searchYearMin = targetYear - 2;
        searchYearMax = targetYear + 2;
      } else {
        searchYearMin = new Date().getFullYear() - 5;
        searchYearMax = new Date().getFullYear();
        targetYear = Math.round((searchYearMin + searchYearMax) / 2);
      }
      
      // Get market listings from database
      let marketListings = await storage.getMarketListings(dealershipId, {
        make,
        model,
        yearMin: searchYearMin,
        yearMax: searchYearMax
      });

      // If no market listings found, return message prompting manual scrape
      if (marketListings.length === 0) {
        return res.json({
          averagePrice: 0,
          medianPrice: 0,
          minPrice: 0,
          maxPrice: 0,
          totalComps: 0,
          comparisons: [],
          priceRange: { low: 0, high: 0 },
          recommendation: `No market data found. Please use the "Refresh Market Data" button to scrape current listings from AutoTrader.`,
          marketPosition: 'at_market',
          meta: {
            dataSource: 'none',
            totalListings: 0,
            sources: [],
            searchRadius: searchRadiusKm,
            postalCode: searchPostalCode,
            years: years || (year ? [parseInt(year)] : []),
            year: targetYear
          }
        });
      }

      // Convert market listings to Vehicle format for pricing analysis
      const vehiclesForAnalysis = marketListings.map(listing => ({
        id: listing.id,
        stockNumber: listing.externalId,
        year: listing.year,
        make: listing.make,
        model: listing.model,
        trim: listing.trim || '',
        price: listing.price,
        mileage: listing.mileage || 0,
        location: listing.location,
        dealership: listing.sellerName,
        source: listing.source,
        listingType: listing.listingType,
        postedDate: listing.postedDate,
        scrapedAt: listing.scrapedAt
      }));
      
      // Import market pricing service
      const { analyzeMarketPricing } = await import('./market-pricing');
      
      // Prepare request
      const pricingRequest = {
        year: targetYear,
        make,
        model,
        trim: trim, // Legacy single trim support
        trims: trims && trims.length > 0 ? trims : undefined, // Multi-trim support
        mileage: mileage ? parseInt(mileage) : undefined,
        radius: searchRadiusKm
      };
      
      // Analyze pricing
      const result = analyzeMarketPricing(pricingRequest, vehiclesForAnalysis as any);
      
      // Calculate source breakdown
      const sourceBreakdown = {
        marketcheck: marketListings.filter(l => l.source === 'marketcheck').length,
        apify: marketListings.filter(l => l.source === 'apify').length,
        autotrader_scraper: marketListings.filter(l => l.source === 'autotrader_scraper').length
      };
      
      // Add meta information about data sources
      const responseWithMeta = {
        ...result,
        meta: {
          dataSource: 'external_market',
          totalListings: marketListings.length,
          sources: Array.from(new Set(marketListings.map(l => l.source))),
          sourceBreakdown,
          searchRadius: searchRadiusKm,
          postalCode: searchPostalCode,
          years: years || (year ? [parseInt(year)] : []),
          year: targetYear
        }
      };
      
      res.json(responseWithMeta);
    } catch (error) {
      console.error("Error analyzing market pricing:", error);
      res.status(500).json({
        error: 'PRICING_ERROR',
        message: error instanceof Error ? error.message : "Failed to analyze market pricing"
      });
    }
  });

  // Get unique makes from market listings (for autocomplete)
  app.get("/api/inventory/makes", authMiddleware, requireRole("manager"), async (req, res) => {
    try {
      // TODO: Multi-tenant - use req.dealershipId when middleware is applied
      const dealershipId = req.dealershipId!;
      // Get all market listings to populate makes
      const marketListings = await storage.getMarketListings(dealershipId, {});
      const makes = Array.from(new Set(marketListings.map(v => v.make))).filter(Boolean).sort();
      res.json(makes);
    } catch (error) {
      console.error("Error fetching makes:", error);
      res.status(500).json({ error: "Failed to fetch makes" });
    }
  });

  // Get unique models for a specific make from market listings (for autocomplete)
  app.get("/api/inventory/models", authMiddleware, requireRole("manager"), async (req, res) => {
    try {
      // TODO: Multi-tenant - use req.dealershipId when middleware is applied
      const dealershipId = req.dealershipId!;
      const { make } = req.query;
      const marketListings = await storage.getMarketListings(dealershipId, {});
      
      let models;
      if (make) {
        models = Array.from(new Set(marketListings.filter(v => v.make === make).map(v => v.model))).filter(Boolean).sort();
      } else {
        models = Array.from(new Set(marketListings.map(v => v.model))).filter(Boolean).sort();
      }
      
      res.json(models);
    } catch (error) {
      console.error("Error fetching models:", error);
      res.status(500).json({ error: "Failed to fetch models" });
    }
  });

  // Get unique trims for a specific make/model from market listings (for autocomplete)
  app.get("/api/inventory/trims", authMiddleware, requireRole("manager"), async (req, res) => {
    try {
      // TODO: Multi-tenant - use req.dealershipId when middleware is applied
      const dealershipId = req.dealershipId!;
      const { make, model } = req.query;
      const marketListings = await storage.getMarketListings(dealershipId, {});
      
      let trims;
      if (make && model) {
        trims = Array.from(new Set(marketListings.filter(v => v.make === make && v.model === model).map(v => v.trim))).filter(Boolean).sort();
      } else if (make) {
        trims = Array.from(new Set(marketListings.filter(v => v.make === make).map(v => v.trim))).filter(Boolean).sort();
      } else {
        trims = Array.from(new Set(marketListings.map(v => v.trim))).filter(Boolean).sort();
      }
      
      res.json(trims);
    } catch (error) {
      console.error("Error fetching trims:", error);
      res.status(500).json({ error: "Failed to fetch trims" });
    }
  });

  // ===== MANAGER SETTINGS ROUTES =====

  // Get manager settings
  app.get("/api/manager/settings", authMiddleware, requireRole("manager"), async (req, res) => {
    try {
      const authReq = req as AuthRequest;
      const userId = authReq.user!.id;
      // TODO: Multi-tenant - use req.dealershipId when middleware is applied
      const dealershipId = req.dealershipId!;
      const settings = await storage.getManagerSettings(userId, dealershipId);
      res.json(settings || null);
    } catch (error) {
      console.error("Error fetching manager settings:", error);
      res.status(500).json({ error: "Failed to fetch settings" });
    }
  });

  // Save manager settings
  app.post("/api/manager/settings", authMiddleware, requireRole("manager"), async (req, res) => {
    try {
      const authReq = req as AuthRequest;
      const userId = authReq.user!.id;
      // TODO: Multi-tenant - use req.dealershipId when middleware is applied
      const dealershipId = req.dealershipId!;
      const { postalCode, defaultRadiusKm } = req.body;

      if (!postalCode) {
        return res.status(400).json({ error: "Postal code is required" });
      }

      // Geocode the postal code to get lat/lon
      const { geocodingService } = await import('./geocoding-service');
      const geocoded = await geocodingService.geocodePostalCode(postalCode);

      const existing = await storage.getManagerSettings(userId, dealershipId);

      if (existing) {
        const updated = await storage.updateManagerSettings(userId, dealershipId, {
          postalCode,
          defaultRadiusKm: defaultRadiusKm || 50,
          geocodeLat: geocoded?.latitude.toString() || null,
          geocodeLon: geocoded?.longitude.toString() || null
        });
        res.json(updated);
      } else {
        const created = await storage.createManagerSettings({
          userId,
          postalCode,
          defaultRadiusKm: defaultRadiusKm || 50,
          geocodeLat: geocoded?.latitude.toString() || null,
          geocodeLon: geocoded?.longitude.toString() || null
        });
        res.json(created);
      }
    } catch (error) {
      console.error("Error saving manager settings:", error);
      res.status(500).json({ error: "Failed to save settings" });
    }
  });

  // Trigger market data aggregation from all sources
  app.post("/api/manager/scrape-market", authMiddleware, requireRole("manager"), async (req, res) => {
    try {
      const { make, model, yearMin, yearMax, postalCode, radiusKm } = req.body;

      if (!make || !model) {
        return res.status(400).json({ error: "Make and model are required" });
      }

      const { marketAggregationService } = await import('./market-aggregation-service');

      const result = await marketAggregationService.aggregateMarketData({
        make,
        model,
        yearMin,
        yearMax,
        postalCode,
        radiusKm,
        maxResults: 100
      });

      // Return error status if all sources failed and no data was saved
      if (!result.success && result.totalListings === 0) {
        return res.status(500).json({
          success: false,
          savedCount: 0,
          marketCheckCount: result.marketCheckCount,
          apifyCount: result.apifyCount,
          scraperCount: result.scraperCount,
          duplicatesRemoved: result.duplicatesRemoved,
          errors: result.errors,
          message: `Failed to aggregate market data. Errors: ${result.errors.join(', ')}`
        });
      }

      res.json({
        success: result.success,
        savedCount: result.totalListings,
        marketCheckCount: result.marketCheckCount,
        apifyCount: result.apifyCount,
        scraperCount: result.scraperCount,
        duplicatesRemoved: result.duplicatesRemoved,
        errors: result.errors,
        message: `Successfully aggregated ${result.totalListings} new listings from ${result.marketCheckCount + result.apifyCount + result.scraperCount} sources (MarketCheck: ${result.marketCheckCount}, Apify: ${result.apifyCount}, Scraper: ${result.scraperCount})`
      });
    } catch (error) {
      console.error("Error aggregating market data:", error);
      res.status(500).json({ error: "Failed to aggregate market data" });
    }
  });

  // ===== REMARKETING ROUTES (Master only) =====
  
  // Get all remarketing vehicles
  app.get("/api/remarketing/vehicles", authMiddleware, requireRole("master"), async (req, res) => {
    try {
      // TODO: Multi-tenant - use req.dealershipId when middleware is applied
      const dealershipId = req.dealershipId!;
      const remarketingVehicles = await storage.getRemarketingVehicles(dealershipId);
      res.json(remarketingVehicles);
    } catch (error) {
      console.error("Error fetching remarketing vehicles:", error);
      res.status(500).json({ error: "Failed to fetch remarketing vehicles" });
    }
  });
  
  // Add vehicle to remarketing
  app.post("/api/remarketing/vehicles", authMiddleware, requireRole("master"), async (req, res) => {
    try {
      const { vehicleId, budgetPriority } = req.body;
      
      if (!vehicleId || budgetPriority === undefined) {
        return res.status(400).json({ error: "vehicleId and budgetPriority are required" });
      }
      
      // TODO: Multi-tenant - use req.dealershipId when middleware is applied
      const dealershipId = req.dealershipId!;
      
      // Check if vehicle exists
      const existingVehicle = await storage.getVehicleById(vehicleId, dealershipId);
      if (!existingVehicle) {
        return res.status(404).json({ error: "Vehicle not found" });
      }
      
      // Check if vehicle is already in remarketing
      const remarketingVehicles = await storage.getRemarketingVehicles(dealershipId);
      if (remarketingVehicles.some(rv => rv.vehicleId === vehicleId)) {
        return res.status(400).json({ error: "Vehicle is already in remarketing" });
      }
      
      // Check if we already have 20 active vehicles
      const count = await storage.getRemarketingVehicleCount(dealershipId);
      if (count >= 20) {
        return res.status(400).json({ error: "Maximum 20 vehicles allowed for remarketing" });
      }
      
      const vehicle = await storage.addRemarketingVehicle({ dealershipId, vehicleId, budgetPriority, isActive: true });
      res.json(vehicle);
    } catch (error) {
      console.error("Error adding remarketing vehicle:", error);
      res.status(500).json({ error: "Failed to add remarketing vehicle" });
    }
  });
  
  // Update remarketing vehicle priority
  app.patch("/api/remarketing/vehicles/:id", authMiddleware, requireRole("master"), async (req, res) => {
    try {
      // TODO: Multi-tenant - use req.dealershipId when middleware is applied
      const dealershipId = req.dealershipId!;
      const id = parseInt(req.params.id);
      const { budgetPriority } = req.body;
      
      const vehicle = await storage.updateRemarketingVehicle(id, dealershipId, { budgetPriority });
      
      if (!vehicle) {
        return res.status(404).json({ error: "Remarketing vehicle not found" });
      }
      
      res.json(vehicle);
    } catch (error) {
      console.error("Error updating remarketing vehicle:", error);
      res.status(500).json({ error: "Failed to update remarketing vehicle" });
    }
  });
  
  // Remove vehicle from remarketing
  app.delete("/api/remarketing/vehicles/:id", authMiddleware, requireRole("master"), async (req, res) => {
    try {
      // TODO: Multi-tenant - use req.dealershipId when middleware is applied
      const dealershipId = req.dealershipId!;
      const id = parseInt(req.params.id);
      const success = await storage.removeRemarketingVehicle(id, dealershipId);
      
      if (!success) {
        return res.status(404).json({ error: "Remarketing vehicle not found" });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error removing remarketing vehicle:", error);
      res.status(500).json({ error: "Failed to remove remarketing vehicle" });
    }
  });

  // ===== PBS DMS INTEGRATION ROUTES =====
  
  // Get PBS configuration
  app.get("/api/pbs/config", authMiddleware, requireRole("master"), async (req, res) => {
    try {
      // TODO: Multi-tenant - use req.dealershipId when middleware is applied
      const dealershipId = req.dealershipId!;
      const config = await storage.getPbsConfig(dealershipId);
      res.json(config || null);
    } catch (error) {
      console.error("Error fetching PBS config:", error);
      res.status(500).json({ error: "Failed to fetch PBS configuration" });
    }
  });
  
  // Create or update PBS configuration
  app.post("/api/pbs/config", authMiddleware, requireRole("master"), async (req, res) => {
    try {
      const { partnerId, username, password, webhookUrl, webhookSecret, pbsApiUrl } = req.body;
      
      if (!partnerId || !username || !password) {
        return res.status(400).json({ error: "partnerId, username, and password are required" });
      }
      
      // TODO: Multi-tenant - use req.dealershipId when middleware is applied
      const dealershipId = req.dealershipId!;
      
      // Check if config exists
      const existing = await storage.getPbsConfig(dealershipId);
      
      let config;
      if (existing) {
        config = await storage.updatePbsConfig(existing.id, dealershipId, {
          partnerId,
          username,
          password,
          webhookUrl,
          webhookSecret,
          pbsApiUrl,
          isActive: true
        });
      } else {
        config = await storage.createPbsConfig({
          dealershipId,
          partnerId,
          username,
          password,
          webhookUrl,
          webhookSecret,
          pbsApiUrl,
          isActive: true
        });
      }
      
      res.json(config);
    } catch (error) {
      console.error("Error saving PBS config:", error);
      res.status(500).json({ error: "Failed to save PBS configuration" });
    }
  });
  
  // Delete PBS configuration
  app.delete("/api/pbs/config/:id", authMiddleware, requireRole("master"), async (req, res) => {
    try {
      // TODO: Multi-tenant - use req.dealershipId when middleware is applied
      const dealershipId = req.dealershipId!;
      const id = parseInt(req.params.id);
      await storage.deletePbsConfig(id, dealershipId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting PBS config:", error);
      res.status(500).json({ error: "Failed to delete PBS configuration" });
    }
  });
  
  // Webhook receiver endpoint (no auth - PBS will call this)
  app.post("/api/pbs/webhook", async (req, res) => {
    try {
      // TODO: Multi-tenant - determine dealershipId from webhook payload or config
      const dealershipId = req.dealershipId!;
      
      // Get PBS config to validate webhook secret
      const pbsConfig = await storage.getPbsConfig(dealershipId);
      
      // If webhook secret is configured, validate the signature
      if (pbsConfig?.webhookSecret) {
        const signature = req.headers['x-pbs-signature'] as string;
        const timestamp = req.headers['x-pbs-timestamp'] as string;
        
        if (!signature || !timestamp) {
          console.error("PBS webhook rejected: Missing signature or timestamp headers");
          return res.status(401).json({ 
            error: "Unauthorized", 
            message: "Missing signature headers" 
          });
        }
        
        // Verify signature using HMAC-SHA256
        const payload = timestamp + '.' + JSON.stringify(req.body);
        const expectedSignature = crypto
          .createHmac('sha256', pbsConfig.webhookSecret)
          .update(payload)
          .digest('hex');
        
        // Use timing-safe comparison to prevent timing attacks
        // First check if lengths match (if not, signature is definitely invalid)
        if (signature.length !== expectedSignature.length) {
          console.error("PBS webhook rejected: Invalid signature length");
          return res.status(403).json({ 
            error: "Forbidden", 
            message: "Invalid signature" 
          });
        }
        
        if (!crypto.timingSafeEqual(
          Buffer.from(signature),
          Buffer.from(expectedSignature)
        )) {
          console.error("PBS webhook rejected: Invalid signature");
          return res.status(403).json({ 
            error: "Forbidden", 
            message: "Invalid signature" 
          });
        }
        
        // Verify timestamp is recent (within 5 minutes) to prevent replay attacks
        const timestampAge = Date.now() - parseInt(timestamp);
        const MAX_AGE = 5 * 60 * 1000; // 5 minutes in milliseconds
        
        if (timestampAge > MAX_AGE || timestampAge < 0) {
          console.error("PBS webhook rejected: Timestamp too old or in future");
          return res.status(403).json({ 
            error: "Forbidden", 
            message: "Timestamp outside valid window" 
          });
        }
      }
      
      const { event, id: eventId, data } = req.body;
      
      // Log the webhook event
      await storage.createPbsWebhookEvent({
        dealershipId,
        eventType: event || 'unknown',
        eventId: eventId || `event-${Date.now()}`,
        payload: JSON.stringify(req.body),
        status: 'pending'
      });
      
      // Acknowledge receipt immediately
      res.json({ success: true, message: "Webhook received" });
      
      // TODO: Process webhook asynchronously based on event type
      // Future implementation: Handle different event types (customer.created, vehicle.updated, etc.)
    } catch (error) {
      console.error("Error processing PBS webhook:", error);
      res.status(500).json({ error: "Failed to process webhook" });
    }
  });
  
  // Get PBS webhook events (for monitoring)
  app.get("/api/pbs/webhook-events", authMiddleware, requireRole("master"), async (req, res) => {
    try {
      // TODO: Multi-tenant - use req.dealershipId when middleware is applied
      const dealershipId = req.dealershipId!;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const events = await storage.getPbsWebhookEvents(dealershipId, limit);
      res.json(events);
    } catch (error) {
      console.error("Error fetching PBS webhook events:", error);
      res.status(500).json({ error: "Failed to fetch webhook events" });
    }
  });
  
  // Update webhook event status (mark as processed/failed)
  app.patch("/api/pbs/webhook-events/:id", authMiddleware, requireRole("master"), async (req, res) => {
    try {
      // TODO: Multi-tenant - use req.dealershipId when middleware is applied
      const dealershipId = req.dealershipId!;
      const id = parseInt(req.params.id);
      const { status, errorMessage } = req.body;
      
      const event = await storage.updatePbsWebhookEvent(id, dealershipId, {
        status,
        errorMessage,
        processedAt: status === 'processed' ? new Date() : undefined
      });
      
      if (!event) {
        return res.status(404).json({ error: "Webhook event not found" });
      }
      
      res.json(event);
    } catch (error) {
      console.error("Error updating webhook event:", error);
      res.status(500).json({ error: "Failed to update webhook event" });
    }
  });

  // ===== ADMIN ROUTES =====
  
  // Save GHL configuration
  app.post("/api/admin/ghl-config", authMiddleware, requireRole("master"), async (req, res) => {
    try {
      // TODO: Multi-tenant - use req.dealershipId when middleware is applied
      const dealershipId = req.dealershipId!;
      const { apiKey, locationId } = req.body;

      if (!apiKey || !locationId) {
        return res.status(400).json({ error: "apiKey and locationId are required" });
      }

      const config = await storage.saveGHLConfig({ dealershipId, apiKey, locationId, isActive: true });
      res.json(config);
    } catch (error) {
      console.error("Error saving GHL config:", error);
      res.status(500).json({ error: "Failed to save GHL configuration" });
    }
  });

  // Save GHL Webhook configuration
  app.post("/api/admin/ghl-webhook-config", authMiddleware, requireRole("master"), async (req, res) => {
    try {
      // TODO: Multi-tenant - use req.dealershipId when middleware is applied
      const dealershipId = req.dealershipId!;
      const { webhookUrl, webhookName } = req.body;

      if (!webhookUrl || !webhookName) {
        return res.status(400).json({ error: "webhookUrl and webhookName are required" });
      }

      const config = await storage.saveGHLWebhookConfig({ 
        dealershipId,
        webhookUrl, 
        webhookName, 
        isActive: true 
      });
      res.json(config);
    } catch (error) {
      console.error("Error saving GHL webhook config:", error);
      res.status(500).json({ error: "Failed to save GHL webhook configuration" });
    }
  });

  // Get GHL Webhook configuration
  app.get("/api/admin/ghl-webhook-config", authMiddleware, requireRole("master"), async (req, res) => {
    try {
      // TODO: Multi-tenant - use req.dealershipId when middleware is applied
      const dealershipId = req.dealershipId!;
      const config = await storage.getActiveGHLWebhookConfig(dealershipId);
      res.json(config || null);
    } catch (error) {
      console.error("Error fetching GHL webhook config:", error);
      res.status(500).json({ error: "Failed to fetch GHL webhook configuration" });
    }
  });

  // Save AI prompt template
  app.post("/api/admin/ai-prompt", authMiddleware, requireRole("master"), async (req, res) => {
    try {
      // TODO: Multi-tenant - use req.dealershipId when middleware is applied
      const dealershipId = req.dealershipId!;
      const { name, promptText, isActive } = req.body;

      if (!name || !promptText) {
        return res.status(400).json({ error: "name and promptText are required" });
      }

      const template = await storage.saveAIPromptTemplate({ name, dealershipId, promptText, isActive });
      res.json(template);
    } catch (error) {
      console.error("Error saving AI prompt:", error);
      res.status(500).json({ error: "Failed to save AI prompt template" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
