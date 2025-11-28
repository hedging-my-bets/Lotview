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

import { authMiddleware, requireRole, generateToken, comparePassword, hashPassword, verifyToken, type AuthRequest } from "./auth";
import { requireDealership, superAdminOnly } from "./tenant-middleware";
import { facebookService } from "./facebook-service";
import crypto from "crypto";
import { decodeVIN } from "./vin-decoder";

// OAuth state store for CSRF protection (in production, use Redis or signed JWTs)
// Includes dealershipId for proper multi-tenant isolation during OAuth callback
const oauthStateStore = new Map<string, { userId: number; accountId: number; dealershipId: number; expiresAt: number }>();

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
  
  // ===== SUPER ADMIN ROUTES (Super Admin Only) =====
  
  // Get all dealerships (super admin only)
  app.get("/api/super-admin/dealerships", authMiddleware, superAdminOnly, async (req, res) => {
    try {
      const dealerships = await storage.getAllDealerships();
      res.json(dealerships);
    } catch (error) {
      console.error("Error fetching dealerships:", error);
      res.status(500).json({ error: "Failed to fetch dealerships" });
    }
  });
  
  // Create new dealership with full setup (super admin only)
  app.post("/api/super-admin/dealerships", authMiddleware, superAdminOnly, async (req, res) => {
    try {
      const { 
        name, 
        slug, 
        subdomain, 
        address,
        city,
        province,
        postalCode,
        phone,
        timezone,
        defaultCurrency,
        masterAdminEmail, 
        masterAdminName, 
        masterAdminPassword,
        // API Keys (optional)
        openaiApiKey,
        marketcheckKey,
        apifyToken,
        apifyActorId,
        geminiApiKey,
        ghlApiKey,
        ghlLocationId,
        facebookAppId,
        facebookAppSecret,
      } = req.body;
      
      // Validate required fields
      if (!name || !slug || !subdomain || !masterAdminEmail || !masterAdminName || !masterAdminPassword) {
        return res.status(400).json({ 
          error: "Missing required fields: name, slug, subdomain, masterAdminEmail, masterAdminName, masterAdminPassword" 
        });
      }
      
      // Check if email already exists
      const existingUser = await storage.getUserByEmail(masterAdminEmail);
      if (existingUser) {
        return res.status(400).json({ error: "Email already in use" });
      }
      
      // Check if slug already exists
      const existingDealership = await storage.getDealershipBySlug(slug);
      if (existingDealership) {
        return res.status(400).json({ error: "Slug already in use" });
      }
      
      // Create dealership with full setup (transactional)
      const result = await storage.createDealershipWithSetup({
        name,
        slug,
        subdomain,
        address,
        city,
        province,
        postalCode,
        phone,
        timezone,
        defaultCurrency,
        masterAdminEmail,
        masterAdminName,
        masterAdminPassword,
        // API Keys
        openaiApiKey,
        marketcheckKey,
        apifyToken,
        apifyActorId,
        geminiApiKey,
        ghlApiKey,
        ghlLocationId,
        facebookAppId,
        facebookAppSecret,
      });
      
      // Log audit action
      const authReq = req as AuthRequest;
      await storage.logAuditAction({
        userId: authReq.user!.id,
        action: "CREATE_DEALERSHIP",
        resource: "dealership",
        resourceId: String(result.dealership.id),
        details: `Created dealership: ${name} with master admin: ${masterAdminEmail}`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });
      
      res.status(201).json(result);
    } catch (error) {
      console.error("Error creating dealership:", error);
      res.status(500).json({ error: "Failed to create dealership" });
    }
  });
  
  // Update dealership settings (super admin only)
  app.patch("/api/super-admin/dealerships/:dealershipId", authMiddleware, superAdminOnly, async (req, res) => {
    try {
      const dealershipId = parseInt(req.params.dealershipId);
      const { 
        name, 
        slug, 
        subdomain, 
        address,
        city,
        province,
        postalCode,
        phone,
        timezone,
        defaultCurrency,
        isActive,
        masterAdminEmail,
        masterAdminName,
        masterAdminPassword,
      } = req.body;
      
      // Check if dealership exists
      const dealership = await storage.getDealership(dealershipId);
      if (!dealership) {
        return res.status(404).json({ error: "Dealership not found" });
      }
      
      // Update dealership basic info
      const dealershipUpdates: Record<string, any> = {};
      if (name !== undefined) dealershipUpdates.name = name;
      if (slug !== undefined) dealershipUpdates.slug = slug;
      if (subdomain !== undefined) dealershipUpdates.subdomain = subdomain;
      if (address !== undefined) dealershipUpdates.address = address;
      if (city !== undefined) dealershipUpdates.city = city;
      if (province !== undefined) dealershipUpdates.province = province;
      if (postalCode !== undefined) dealershipUpdates.postalCode = postalCode;
      if (phone !== undefined) dealershipUpdates.phone = phone;
      if (timezone !== undefined) dealershipUpdates.timezone = timezone;
      if (defaultCurrency !== undefined) dealershipUpdates.defaultCurrency = defaultCurrency;
      if (isActive !== undefined) dealershipUpdates.isActive = isActive;
      
      let updatedDealership = dealership;
      if (Object.keys(dealershipUpdates).length > 0) {
        updatedDealership = await storage.updateDealership(dealershipId, dealershipUpdates) || dealership;
      }
      
      // Handle master admin user creation or update
      let masterUser = null;
      if (masterAdminEmail && masterAdminPassword) {
        // Check if this email already exists
        const existingUser = await storage.getUserByEmail(masterAdminEmail);
        
        if (existingUser) {
          // Update existing user if it belongs to this dealership or has no dealership
          if (existingUser.dealershipId === dealershipId || existingUser.dealershipId === null) {
            const hashedPassword = await hashPassword(masterAdminPassword);
            masterUser = await storage.updateUser(existingUser.id, {
              name: masterAdminName || existingUser.name,
              passwordHash: hashedPassword,
              dealershipId,
              role: 'master',
            });
          } else {
            return res.status(400).json({ error: "Email already in use by another dealership" });
          }
        } else {
          // Create new master user
          const hashedPassword = await hashPassword(masterAdminPassword);
          masterUser = await storage.createUser({
            email: masterAdminEmail,
            passwordHash: hashedPassword,
            name: masterAdminName || masterAdminEmail.split('@')[0],
            role: 'master',
            dealershipId,
            isActive: true,
            createdBy: (req as AuthRequest).user!.id,
          });
        }
      }
      
      // Log audit action
      const authReq = req as AuthRequest;
      await storage.logAuditAction({
        userId: authReq.user!.id,
        action: "UPDATE_DEALERSHIP",
        resource: "dealership",
        resourceId: String(dealershipId),
        details: `Updated dealership: ${updatedDealership.name}${masterUser ? ` with master admin: ${masterUser.email}` : ''}`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });
      
      res.json({ 
        dealership: updatedDealership,
        masterUser: masterUser ? { id: masterUser.id, email: masterUser.email, name: masterUser.name } : null
      });
    } catch (error) {
      console.error("Error updating dealership:", error);
      res.status(500).json({ error: "Failed to update dealership" });
    }
  });
  
  // Get dealership details with master user (super admin only)
  app.get("/api/super-admin/dealerships/:dealershipId", authMiddleware, superAdminOnly, async (req, res) => {
    try {
      const dealershipId = parseInt(req.params.dealershipId);
      
      const dealership = await storage.getDealership(dealershipId);
      if (!dealership) {
        return res.status(404).json({ error: "Dealership not found" });
      }
      
      // Get master user for this dealership
      const users = await storage.getUsersByDealership(dealershipId);
      const masterUser = users.find(u => u.role === 'master');
      
      res.json({
        dealership,
        masterUser: masterUser ? { id: masterUser.id, email: masterUser.email, name: masterUser.name } : null
      });
    } catch (error) {
      console.error("Error fetching dealership details:", error);
      res.status(500).json({ error: "Failed to fetch dealership details" });
    }
  });
  
  // Get all global settings (super admin only)
  app.get("/api/super-admin/global-settings", authMiddleware, superAdminOnly, async (req, res) => {
    try {
      const settings = await storage.getAllGlobalSettings();
      res.json(settings);
    } catch (error) {
      console.error("Error fetching global settings:", error);
      res.status(500).json({ error: "Failed to fetch global settings" });
    }
  });
  
  // Set or update a global setting (super admin only)
  app.put("/api/super-admin/global-settings/:key", authMiddleware, superAdminOnly, async (req, res) => {
    try {
      const { key } = req.params;
      const { value, description, isSecret } = req.body;
      
      if (!value) {
        return res.status(400).json({ error: "Value is required" });
      }
      
      const authReq = req as AuthRequest;
      const setting = await storage.setGlobalSetting({
        key,
        value,
        description,
        isSecret: isSecret ?? true,
        updatedBy: authReq.user!.id
      });
      
      // Log audit action
      await storage.logAuditAction({
        userId: authReq.user!.id,
        action: "UPDATE_GLOBAL_SETTING",
        resource: "global_setting",
        resourceId: key,
        details: `Updated global setting: ${key}`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });
      
      res.json(setting);
    } catch (error) {
      console.error("Error setting global setting:", error);
      res.status(500).json({ error: "Failed to set global setting" });
    }
  });
  
  // Delete a global setting (super admin only)
  app.delete("/api/super-admin/global-settings/:key", authMiddleware, superAdminOnly, async (req, res) => {
    try {
      const { key } = req.params;
      
      const deleted = await storage.deleteGlobalSetting(key);
      if (!deleted) {
        return res.status(404).json({ error: "Setting not found" });
      }
      
      // Log audit action
      const authReq = req as AuthRequest;
      await storage.logAuditAction({
        userId: authReq.user!.id,
        action: "DELETE_GLOBAL_SETTING",
        resource: "global_setting",
        resourceId: key,
        details: `Deleted global setting: ${key}`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting global setting:", error);
      res.status(500).json({ error: "Failed to delete global setting" });
    }
  });
  
  // Get audit logs (super admin only)
  app.get("/api/super-admin/audit-logs", authMiddleware, superAdminOnly, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      
      const result = await storage.getAuditLogs(limit, offset);
      res.json(result);
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      res.status(500).json({ error: "Failed to fetch audit logs" });
    }
  });
  
  // Get API keys for a specific dealership (super admin only)
  app.get("/api/super-admin/dealerships/:dealershipId/api-keys", authMiddleware, superAdminOnly, async (req, res) => {
    try {
      const dealershipId = parseInt(req.params.dealershipId);
      const apiKeys = await storage.getDealershipApiKeys(dealershipId);
      
      if (!apiKeys) {
        return res.json({
          dealershipId,
          openaiApiKey: null,
          facebookAppId: null,
          facebookAppSecret: null,
          marketcheckKey: null,
          apifyToken: null,
          apifyActorId: null,
          geminiApiKey: null,
          ghlApiKey: null,
          ghlLocationId: null,
          gtmContainerId: null,
          googleAnalyticsId: null,
          googleAdsId: null,
          facebookPixelId: null,
        });
      }
      
      res.json(apiKeys);
    } catch (error) {
      console.error("Error fetching dealership API keys:", error);
      res.status(500).json({ error: "Failed to fetch dealership API keys" });
    }
  });
  
  // Update API keys for a specific dealership (super admin only)
  app.patch("/api/super-admin/dealerships/:dealershipId/api-keys", authMiddleware, superAdminOnly, async (req, res) => {
    try {
      const dealershipId = parseInt(req.params.dealershipId);
      const updates = req.body;
      
      // Check if dealership exists
      const dealership = await storage.getDealership(dealershipId);
      if (!dealership) {
        return res.status(404).json({ error: "Dealership not found" });
      }
      
      // Check if API keys exist, create if not
      const existing = await storage.getDealershipApiKeys(dealershipId);
      let apiKeys;
      
      if (existing) {
        apiKeys = await storage.updateDealershipApiKeys(dealershipId, updates);
      } else {
        apiKeys = await storage.saveDealershipApiKeys({
          dealershipId,
          ...updates,
        });
      }
      
      // Log audit action
      const authReq = req as AuthRequest;
      await storage.logAuditAction({
        userId: authReq.user!.id,
        action: "UPDATE_DEALERSHIP_API_KEYS",
        resource: "dealership_api_keys",
        resourceId: String(dealershipId),
        details: `Updated API keys for dealership: ${dealership.name}`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });
      
      res.json(apiKeys);
    } catch (error) {
      console.error("Error updating dealership API keys:", error);
      res.status(500).json({ error: "Failed to update dealership API keys" });
    }
  });
  
  // Test OpenAI API key for a dealership (super admin only)
  app.post("/api/super-admin/dealerships/:dealershipId/test-openai", authMiddleware, superAdminOnly, async (req, res) => {
    try {
      const dealershipId = parseInt(req.params.dealershipId);
      const apiKeys = await storage.getDealershipApiKeys(dealershipId);
      
      if (!apiKeys?.openaiApiKey) {
        return res.json({ success: false, error: "OpenAI API key not configured" });
      }
      
      // Test the API key with a simple completion request
      const response = await fetch("https://api.openai.com/v1/models", {
        headers: {
          "Authorization": `Bearer ${apiKeys.openaiApiKey}`,
        },
      });
      
      if (response.ok) {
        res.json({ success: true, message: "OpenAI API key is valid" });
      } else {
        const error = await response.json();
        res.json({ success: false, error: error.error?.message || "Invalid API key" });
      }
    } catch (error) {
      console.error("Error testing OpenAI API key:", error);
      res.json({ success: false, error: "Connection failed" });
    }
  });
  
  // Test Facebook App credentials for a dealership (super admin only)
  app.post("/api/super-admin/dealerships/:dealershipId/test-facebook", authMiddleware, superAdminOnly, async (req, res) => {
    try {
      const dealershipId = parseInt(req.params.dealershipId);
      const apiKeys = await storage.getDealershipApiKeys(dealershipId);
      
      if (!apiKeys?.facebookAppId || !apiKeys?.facebookAppSecret) {
        return res.json({ success: false, error: "Facebook App ID or Secret not configured" });
      }
      
      // Test credentials by getting an app access token
      const response = await fetch(
        `https://graph.facebook.com/oauth/access_token?client_id=${apiKeys.facebookAppId}&client_secret=${apiKeys.facebookAppSecret}&grant_type=client_credentials`
      );
      
      if (response.ok) {
        res.json({ success: true, message: "Facebook credentials are valid" });
      } else {
        const error = await response.json();
        res.json({ success: false, error: error.error?.message || "Invalid credentials" });
      }
    } catch (error) {
      console.error("Error testing Facebook credentials:", error);
      res.json({ success: false, error: "Connection failed" });
    }
  });
  
  // Test GoHighLevel API key for a dealership (super admin only)
  app.post("/api/super-admin/dealerships/:dealershipId/test-ghl", authMiddleware, superAdminOnly, async (req, res) => {
    try {
      const dealershipId = parseInt(req.params.dealershipId);
      const apiKeys = await storage.getDealershipApiKeys(dealershipId);
      
      if (!apiKeys?.ghlApiKey || !apiKeys?.ghlLocationId) {
        return res.json({ success: false, error: "GHL API Key or Location ID not configured" });
      }
      
      // Test the API key by getting location info
      const response = await fetch(
        `https://services.leadconnectorhq.com/locations/${apiKeys.ghlLocationId}`,
        {
          headers: {
            "Authorization": `Bearer ${apiKeys.ghlApiKey}`,
            "Version": "2021-04-15",
          },
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        res.json({ success: true, message: `Connected to: ${data.location?.name || 'GHL Location'}` });
      } else {
        const error = await response.json();
        res.json({ success: false, error: error.message || "Invalid API key or Location ID" });
      }
    } catch (error) {
      console.error("Error testing GHL credentials:", error);
      res.json({ success: false, error: "Connection failed" });
    }
  });
  
  // Test MarketCheck API key for a dealership (super admin only)
  app.post("/api/super-admin/dealerships/:dealershipId/test-marketcheck", authMiddleware, superAdminOnly, async (req, res) => {
    try {
      const dealershipId = parseInt(req.params.dealershipId);
      const apiKeys = await storage.getDealershipApiKeys(dealershipId);
      
      if (!apiKeys?.marketcheckKey) {
        return res.json({ success: false, error: "MarketCheck API key not configured" });
      }
      
      // Test the API key with a simple stats request
      const response = await fetch(
        `https://api.marketcheck.com/v2/stats/car?api_key=${apiKeys.marketcheckKey}&limit=1`
      );
      
      if (response.ok) {
        res.json({ success: true, message: "MarketCheck API key is valid" });
      } else if (response.status === 401 || response.status === 403) {
        res.json({ success: false, error: "Invalid API key" });
      } else {
        res.json({ success: false, error: `API error: ${response.status}` });
      }
    } catch (error) {
      console.error("Error testing MarketCheck credentials:", error);
      res.json({ success: false, error: "Connection failed" });
    }
  });
  
  // Test Apify API token for a dealership (super admin only)
  app.post("/api/super-admin/dealerships/:dealershipId/test-apify", authMiddleware, superAdminOnly, async (req, res) => {
    try {
      const dealershipId = parseInt(req.params.dealershipId);
      const apiKeys = await storage.getDealershipApiKeys(dealershipId);
      
      if (!apiKeys?.apifyToken) {
        return res.json({ success: false, error: "Apify API token not configured" });
      }
      
      // Test the API token by getting user info
      const response = await fetch(
        "https://api.apify.com/v2/users/me",
        {
          headers: {
            "Authorization": `Bearer ${apiKeys.apifyToken}`,
          },
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        res.json({ success: true, message: `Connected as: ${data.data?.username || 'Apify User'}` });
      } else {
        res.json({ success: false, error: "Invalid API token" });
      }
    } catch (error) {
      console.error("Error testing Apify credentials:", error);
      res.json({ success: false, error: "Connection failed" });
    }
  });

  // Test Gemini API key for a dealership (super admin only)
  app.post("/api/super-admin/dealerships/:dealershipId/test-gemini", authMiddleware, superAdminOnly, async (req, res) => {
    try {
      const dealershipId = parseInt(req.params.dealershipId);
      const { GeminiService } = await import("./gemini-service");
      const geminiService = await GeminiService.getInstanceForDealership(dealershipId);
      
      if (!geminiService) {
        return res.json({ success: false, error: "Gemini API key not configured" });
      }
      
      const result = await geminiService.testConnection();
      
      if (result.success) {
        res.json({ 
          success: true, 
          message: `Connected! ${result.modelInfo?.total || 0} models available` 
        });
      } else {
        res.json({ success: false, error: result.error || "Connection failed" });
      }
    } catch (error) {
      console.error("Error testing Gemini credentials:", error);
      res.json({ success: false, error: "Connection failed" });
    }
  });
  
  // Get all dealerships with API key status (super admin only)
  app.get("/api/super-admin/dealerships-with-integrations", authMiddleware, superAdminOnly, async (req, res) => {
    try {
      const dealerships = await storage.getAllDealerships();
      
      // Get API keys for all dealerships
      const dealershipsWithIntegrations = await Promise.all(
        dealerships.map(async (dealership) => {
          const apiKeys = await storage.getDealershipApiKeys(dealership.id);
          return {
            ...dealership,
            integrations: {
              openai: !!apiKeys?.openaiApiKey,
              facebook: !!(apiKeys?.facebookAppId && apiKeys?.facebookAppSecret),
              marketcheck: !!apiKeys?.marketcheckKey,
              apify: !!apiKeys?.apifyToken,
              gemini: !!apiKeys?.geminiApiKey,
              ghl: !!(apiKeys?.ghlApiKey && apiKeys?.ghlLocationId),
              googleAnalytics: !!apiKeys?.googleAnalyticsId,
              googleAds: !!apiKeys?.googleAdsId,
              facebookPixel: !!apiKeys?.facebookPixelId,
            },
          };
        })
      );
      
      res.json(dealershipsWithIntegrations);
    } catch (error) {
      console.error("Error fetching dealerships with integrations:", error);
      res.status(500).json({ error: "Failed to fetch dealerships with integrations" });
    }
  });
  
  // ===== USER MANAGEMENT ROUTES (Master Only) =====
  
  // Get all users (master only)
  app.get("/api/users", authMiddleware, requireRole("master"), requireDealership, async (req, res) => {
    try {
      // Single-dealership mode: Master users see users from dealershipId=1
      // Multi-tenant expansion: Add dealership switcher or query param to allow master users to view any dealership
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
  app.post("/api/users", authMiddleware, requireRole("master"), requireDealership, async (req, res) => {
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
      
      // Single-dealership mode: Non-master users assigned to dealershipId=1, master users have null
      // Multi-tenant expansion: Add dealershipId field to request body for master users to specify target dealership
      const dealershipId = role === "master" ? null : req.dealershipId!;
      
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
  app.patch("/api/users/:id", authMiddleware, requireRole("master"), requireDealership, async (req, res) => {
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
      
      // Master users can update any user (dealershipId = undefined bypasses tenant filter)
      // Multi-tenant expansion: Add dealership validation for non-master users
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
      // Dealership ID extracted from tenant middleware
      const dealershipId = req.dealershipId!;
      
      // Parse pagination parameters (optional - maintains backward compatibility)
      const page = req.query.page ? parseInt(req.query.page as string) : undefined;
      const limit = page ? Math.min(parseInt(req.query.limit as string) || 50, 100) : 10000; // No limit if page not specified
      const offset = page ? (page - 1) * limit : 0;
      
      const { vehicles: vehiclesList, total } = await storage.getVehicles(dealershipId, limit, offset);
      
      // Add randomized view counts (5-35 views) to create social proof
      const vehiclesWithViews = vehiclesList.map(vehicle => ({
        ...vehicle,
        views: Math.floor(Math.random() * (35 - 5 + 1)) + 5 // Random between 5-35
      }));
      
      // Return paginated response if page param provided, otherwise return array (backward compatible)
      if (page) {
        res.json({
          data: vehiclesWithViews,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
          }
        });
      } else {
        res.json(vehiclesWithViews);
      }
    } catch (error) {
      console.error("Error fetching vehicles:", error);
      res.status(500).json({ error: "Failed to fetch vehicles" });
    }
  });

  // Get vehicle by ID with view count (randomized for engagement)
  app.get("/api/vehicles/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      // Dealership ID extracted from tenant middleware
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

  // ===== PUBLIC FINANCING RULES (Customer-facing, no auth required) =====
  
  // Get financing rules for payment calculator (public endpoint)
  app.get("/api/public/financing-rules", async (req, res) => {
    try {
      const dealershipId = req.dealershipId!;
      
      // Get active credit score tiers
      const creditTiers = await storage.getCreditScoreTiers(dealershipId);
      const activeTiers = creditTiers.filter(tier => tier.isActive);
      
      // Get active model year terms
      const modelYearTerms = await storage.getModelYearTerms(dealershipId);
      const activeTerms = modelYearTerms.filter(term => term.isActive);
      
      // If no tiers configured, return sensible defaults
      const defaultTiers = activeTiers.length > 0 ? activeTiers : [
        { tierName: 'Excellent', minScore: 720, maxScore: 850, interestRate: 599 },
        { tierName: 'Good', minScore: 680, maxScore: 719, interestRate: 799 },
        { tierName: 'Fair', minScore: 620, maxScore: 679, interestRate: 999 },
        { tierName: 'Poor', minScore: 300, maxScore: 619, interestRate: 1299 },
      ];
      
      // If no model year terms configured, return sensible defaults
      const defaultTerms = activeTerms.length > 0 ? activeTerms : [
        { minModelYear: 2022, maxModelYear: 2025, availableTerms: ['36', '48', '60', '72', '84'] },
        { minModelYear: 2019, maxModelYear: 2021, availableTerms: ['36', '48', '60', '72'] },
        { minModelYear: 2016, maxModelYear: 2018, availableTerms: ['36', '48', '60'] },
        { minModelYear: 2010, maxModelYear: 2015, availableTerms: ['36', '48'] },
      ];
      
      res.json({
        creditTiers: defaultTiers.map(t => ({
          tierName: t.tierName,
          minScore: t.minScore,
          maxScore: t.maxScore,
          interestRate: t.interestRate / 100, // Convert basis points to percentage (599 -> 5.99%)
        })),
        modelYearTerms: defaultTerms.map(t => ({
          minModelYear: t.minModelYear,
          maxModelYear: t.maxModelYear,
          availableTerms: t.availableTerms.map(term => parseInt(term)),
        })),
      });
    } catch (error) {
      console.error("Error fetching financing rules:", error);
      res.status(500).json({ error: "Failed to fetch financing rules" });
    }
  });

  // Get tracking/remarketing pixel configuration (public endpoint for frontend)
  app.get("/api/public/tracking-config", async (req, res) => {
    try {
      const dealershipId = req.dealershipId!;
      
      // Get dealership API keys which contain tracking IDs
      const apiKeys = await storage.getDealershipApiKeys(dealershipId);
      
      // Return only tracking-related IDs (never expose API secrets)
      res.json({
        gtmContainerId: apiKeys?.gtmContainerId || null,
        googleAnalyticsId: apiKeys?.googleAnalyticsId || null,
        googleAdsId: apiKeys?.googleAdsId || null,
        facebookPixelId: apiKeys?.facebookPixelId || null,
      });
    } catch (error) {
      console.error("Error fetching tracking config:", error);
      res.status(500).json({ error: "Failed to fetch tracking config" });
    }
  });

  // ===== EXTERNAL API TOKENS (for n8n and other integrations) =====
  
  // List external API tokens (master only)
  app.get("/api/external-tokens", authMiddleware, requireRole("master"), requireDealership, async (req, res) => {
    try {
      const dealershipId = req.dealershipId!;
      const tokens = await storage.getExternalApiTokens(dealershipId);
      
      // Never expose the full token hash, only return metadata
      const safeTokens = tokens.map(t => ({
        id: t.id,
        tokenName: t.tokenName,
        tokenPrefix: t.tokenPrefix,
        permissions: t.permissions,
        lastUsedAt: t.lastUsedAt,
        expiresAt: t.expiresAt,
        isActive: t.isActive,
        createdAt: t.createdAt
      }));
      
      res.json(safeTokens);
    } catch (error) {
      console.error("Error fetching external tokens:", error);
      res.status(500).json({ error: "Failed to fetch external tokens" });
    }
  });
  
  // Create external API token (master only) - returns the raw token ONCE
  app.post("/api/external-tokens", authMiddleware, requireRole("master"), requireDealership, async (req, res) => {
    try {
      const { tokenName, permissions, expiresAt } = req.body;
      const authReq = req as AuthRequest;
      const dealershipId = req.dealershipId!;
      const userId = authReq.user!.id;
      
      if (!tokenName || !permissions || !Array.isArray(permissions)) {
        return res.status(400).json({ error: "tokenName and permissions are required" });
      }
      
      // Valid permissions
      const validPerms = ["import:vehicles", "read:vehicles", "update:vehicles", "delete:vehicles"];
      if (!permissions.every(p => validPerms.includes(p))) {
        return res.status(400).json({ error: `Invalid permissions. Valid: ${validPerms.join(", ")}` });
      }
      
      // Generate a secure token: oag_{prefix}_{random}
      const prefix = `oag_${tokenName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 4)}_`;
      const randomPart = crypto.randomBytes(24).toString('base64url');
      const rawToken = prefix + randomPart;
      const tokenHash = await hashPassword(rawToken);
      
      const token = await storage.createExternalApiToken({
        dealershipId,
        tokenName,
        tokenHash,
        tokenPrefix: prefix,
        permissions,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        isActive: true,
        createdBy: userId
      });
      
      // Return the raw token ONCE - it can never be retrieved again
      res.status(201).json({
        id: token.id,
        tokenName: token.tokenName,
        rawToken, // This is shown only once!
        tokenPrefix: token.tokenPrefix,
        permissions: token.permissions,
        expiresAt: token.expiresAt,
        message: "Save this token now - it won't be shown again!"
      });
    } catch (error) {
      console.error("Error creating external token:", error);
      res.status(500).json({ error: "Failed to create external token" });
    }
  });
  
  // Delete external API token (master only)
  app.delete("/api/external-tokens/:id", authMiddleware, requireRole("master"), requireDealership, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const dealershipId = req.dealershipId!;
      
      const deleted = await storage.deleteExternalApiToken(id, dealershipId);
      if (!deleted) {
        return res.status(404).json({ error: "Token not found" });
      }
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting external token:", error);
      res.status(500).json({ error: "Failed to delete external token" });
    }
  });
  
  // ===== VEHICLE IMPORT API (for n8n) =====
  
  // Middleware to validate external API token
  const externalApiAuth = async (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: "Missing or invalid Authorization header" });
    }
    
    const rawToken = authHeader.substring(7);
    
    // Extract prefix (first part before the random section)
    const prefixMatch = rawToken.match(/^(oag_[a-z0-9]+_)/);
    if (!prefixMatch) {
      return res.status(401).json({ error: "Invalid token format" });
    }
    
    const prefix = prefixMatch[1];
    const token = await storage.getExternalApiTokenByPrefix(prefix);
    
    if (!token) {
      return res.status(401).json({ error: "Invalid token" });
    }
    
    if (!token.isActive) {
      return res.status(401).json({ error: "Token is deactivated" });
    }
    
    if (token.expiresAt && token.expiresAt < new Date()) {
      return res.status(401).json({ error: "Token has expired" });
    }
    
    // Verify the token hash
    const isValid = await comparePassword(rawToken, token.tokenHash);
    if (!isValid) {
      return res.status(401).json({ error: "Invalid token" });
    }
    
    // Update last used timestamp
    await storage.updateExternalApiTokenLastUsed(token.id);
    
    // Attach token info to request
    req.externalToken = token;
    req.dealershipId = token.dealershipId;
    
    next();
  };
  
  // Import vehicles from external sources (n8n)
  app.post("/api/import/vehicles", externalApiAuth, async (req: any, res) => {
    try {
      const token = req.externalToken;
      const dealershipId = req.dealershipId;
      
      // Check permission
      if (!token.permissions.includes("import:vehicles")) {
        return res.status(403).json({ error: "Token does not have import:vehicles permission" });
      }
      
      const { vehicles: vehicleData, options } = req.body;
      
      if (!Array.isArray(vehicleData) || vehicleData.length === 0) {
        return res.status(400).json({ error: "vehicles array is required and must not be empty" });
      }
      
      if (vehicleData.length > 100) {
        return res.status(400).json({ error: "Maximum 100 vehicles per import" });
      }
      
      const results: { success: any[]; errors: any[] } = { success: [], errors: [] };
      const updateExisting = options?.updateExisting ?? true;
      
      for (let i = 0; i < vehicleData.length; i++) {
        const v = vehicleData[i];
        try {
          // Validate required fields
          const required = ['year', 'make', 'model', 'trim', 'type', 'price', 'odometer', 'location', 'dealership', 'description'];
          const missing = required.filter(f => v[f] === undefined || v[f] === null || v[f] === '');
          
          if (missing.length > 0) {
            results.errors.push({ index: i, vin: v.vin, error: `Missing required fields: ${missing.join(', ')}` });
            continue;
          }
          
          // Check if vehicle exists by VIN
          let existingVehicle = null;
          if (v.vin && updateExisting) {
            const { vehicles: allVehicles } = await storage.getVehicles(dealershipId);
            existingVehicle = allVehicles.find((ev: any) => ev.vin === v.vin);
          }
          
          const vehiclePayload = {
            dealershipId,
            year: parseInt(v.year),
            make: v.make,
            model: v.model,
            trim: v.trim || '',
            type: v.type,
            price: parseInt(v.price),
            odometer: parseInt(v.odometer),
            images: Array.isArray(v.images) ? v.images : [],
            badges: Array.isArray(v.badges) ? v.badges : [],
            location: v.location,
            dealership: v.dealership,
            description: v.description,
            vin: v.vin || null,
            stockNumber: v.stockNumber || null,
            cargurusPrice: v.cargurusPrice ? parseInt(v.cargurusPrice) : null,
            cargurusUrl: v.cargurusUrl || null,
            dealRating: v.dealRating || null,
            carfaxUrl: v.carfaxUrl || null,
            dealerVdpUrl: v.dealerVdpUrl || null,
          };
          
          if (existingVehicle) {
            // Update existing vehicle
            const updated = await storage.updateVehicle(existingVehicle.id, vehiclePayload, dealershipId);
            results.success.push({ id: updated?.id, vin: v.vin, action: 'updated' });
          } else {
            // Create new vehicle
            const created = await storage.createVehicle(vehiclePayload);
            results.success.push({ id: created.id, vin: v.vin, action: 'created' });
          }
        } catch (err: any) {
          results.errors.push({ index: i, vin: v.vin, error: err.message });
        }
      }
      
      res.json({
        imported: results.success.length,
        failed: results.errors.length,
        results
      });
    } catch (error: any) {
      console.error("Error importing vehicles:", error);
      res.status(500).json({ error: "Failed to import vehicles", details: error.message });
    }
  });

  // Create vehicle (master only)
  app.post("/api/vehicles", authMiddleware, requireRole("master"), requireDealership, async (req, res) => {
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
  app.patch("/api/vehicles/:id", authMiddleware, requireRole("master"), requireDealership, async (req, res) => {
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
  app.delete("/api/vehicles/:id", authMiddleware, requireRole("master"), requireDealership, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      // Dealership ID extracted from authenticated user via tenant middleware
      const dealershipId = req.dealershipId!;
      await storage.deleteVehicle(id, dealershipId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting vehicle:", error);
      res.status(500).json({ error: "Failed to delete vehicle" });
    }
  });

  // Generate video for vehicle using Gemini Veo (master only)
  app.post("/api/vehicles/:id/generate-video", authMiddleware, requireRole("master"), requireDealership, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const dealershipId = req.dealershipId!;
      const vehicle = await storage.getVehicleById(id, dealershipId);
      
      if (!vehicle) {
        return res.status(404).json({ error: "Vehicle not found" });
      }

      // Get Gemini service for this dealership (uses API key from database)
      const { GeminiService } = await import("./gemini-service");
      const geminiService = await GeminiService.getInstanceForDealership(dealershipId);
      
      if (!geminiService) {
        return res.status(503).json({ 
          error: "Gemini API key not configured. Please configure in admin panel under API Keys.",
          estimatedCost: "$0.90-$1.20",
          estimatedTime: "~60 seconds"
        });
      }

      // Generate video prompt based on vehicle data
      const prompt = await geminiService.generateVehicleVideoPrompt({
        year: vehicle.year,
        make: vehicle.make,
        model: vehicle.model,
        trim: vehicle.trim || undefined,
        type: vehicle.type,
        mileage: vehicle.odometer,
      });

      // Attempt video generation
      const result = await geminiService.generateVideo({
        prompt,
        aspectRatio: "16:9",
        durationSeconds: 6,
        resolution: "720p",
        negativePrompt: "watermark, logo, text, low quality, distortion, blurry"
      });

      if (result.success && result.videoUrl) {
        res.json({ 
          success: true,
          videoUrl: result.videoUrl,
          generationTimeSeconds: result.generationTimeSeconds,
          estimatedCost: result.estimatedCost
        });
      } else {
        res.status(501).json({ 
          message: "Video generation requires Vertex AI project configuration",
          note: "Gemini API key configured but video generation requires additional Vertex AI setup",
          suggestedPrompt: prompt,
          estimatedCost: result.estimatedCost || "$0.90-$1.20",
          estimatedTime: "~60 seconds"
        });
      }
    } catch (error) {
      console.error("Error generating video:", error);
      res.status(500).json({ error: "Failed to generate video" });
    }
  });

  // Generate AI description for vehicle using Gemini (master only)
  app.post("/api/vehicles/:id/generate-description", authMiddleware, requireRole("master"), requireDealership, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const dealershipId = req.dealershipId!;
      const vehicle = await storage.getVehicleById(id, dealershipId);
      
      if (!vehicle) {
        return res.status(404).json({ error: "Vehicle not found" });
      }

      // Get Gemini service for this dealership (uses API key from database)
      const { GeminiService } = await import("./gemini-service");
      const geminiService = await GeminiService.getInstanceForDealership(dealershipId);
      
      if (!geminiService) {
        return res.status(503).json({ 
          error: "Gemini API key not configured. Please configure in admin panel under API Keys."
        });
      }

      const result = await geminiService.generateVehicleDescription({
        year: vehicle.year,
        make: vehicle.make,
        model: vehicle.model,
        trim: vehicle.trim || undefined,
        type: vehicle.type,
        mileage: vehicle.odometer,
        price: vehicle.price,
        badges: vehicle.badges || undefined,
        description: vehicle.description || undefined,
      });

      if (result.success && result.description) {
        res.json({ 
          success: true,
          description: result.description
        });
      } else {
        res.status(500).json({ 
          success: false,
          error: result.error || "Failed to generate description"
        });
      }
    } catch (error) {
      console.error("Error generating description:", error);
      res.status(500).json({ error: "Failed to generate description" });
    }
  });

  // ===== VIEW TRACKING ROUTES =====
  
  // Track vehicle view (for remarketing)
  app.post("/api/vehicles/:id/view", async (req, res) => {
    try {
      const vehicleId = parseInt(req.params.id);
      const sessionId = req.body.sessionId || `session-${Date.now()}`;
      // Dealership ID obtained from vehicle record for validation
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
      // Dealership ID obtained from vehicle record for validation
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
      const { messages, vehicleContext, scenario, dealershipId } = req.body;

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

      // Use dealershipId from request, fallback to default (1 for backward compatibility)
      const finalDealershipId = dealershipId || 1;
      const finalScenario = scenario || 'general';

      const response = await generateChatResponse(
        messages as ChatMessage[], 
        finalDealershipId,
        finalScenario,
        vehicleContext
      );
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

      // Dealership ID from request context
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
      const dealershipId = req.dealershipId!;
      const category = req.query.category as string | undefined;
      
      // Parse pagination parameters (optional)
      const page = req.query.page ? parseInt(req.query.page as string) : undefined;
      const limit = page ? Math.min(parseInt(req.query.limit as string) || 50, 100) : 10000; // No limit if page not specified
      const offset = page ? (page - 1) * limit : 0;
      
      const { conversations, total } = await storage.getAllConversations(dealershipId, category, limit, offset);
      
      // Parse messages JSON for each conversation
      const parsed = conversations.map(conv => ({
        ...conv,
        messages: JSON.parse(conv.messages)
      }));
      
      // Return paginated response if page param provided, otherwise return array (backward compatible)
      if (page) {
        res.json({
          data: parsed,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
          }
        });
      } else {
        res.json(parsed);
      }
    } catch (error) {
      console.error("Error fetching conversations:", error);
      res.status(500).json({ error: "Failed to fetch conversations" });
    }
  });

  // Get conversation by ID - ADMIN ONLY
  app.get("/api/conversations/:id", authMiddleware, requireRole("master"), async (req, res) => {
    try {
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
      const dealershipId = req.dealershipId!;
      const { scenario } = req.body;

      if (!scenario) {
        return res.status(400).json({ error: "scenario is required" });
      }

      // Get conversations for this scenario (no pagination - need full dataset for insights)
      const { conversations } = await storage.getAllConversations(dealershipId, scenario, 10000, 0);

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
        dealershipId,
        'general'
      );

      res.json({ insights: response, conversationCount: conversations.length });
    } catch (error) {
      console.error("Error generating insights:", error);
      res.status(500).json({ error: "Failed to generate insights" });
    }
  });

  // ===== DEALERSHIP API KEYS ROUTES =====

  // Get dealership API keys - ADMIN ONLY
  app.get("/api/dealership-api-keys", authMiddleware, requireRole("master"), async (req, res) => {
    try {
      const dealershipId = req.dealershipId!;
      const apiKeys = await storage.getDealershipApiKeys(dealershipId);
      
      // Mask all API keys for security (show only last 4 characters)
      if (apiKeys) {
        const masked = {
          ...apiKeys,
          openaiApiKey: apiKeys.openaiApiKey ? `****${apiKeys.openaiApiKey.slice(-4)}` : null,
          marketcheckKey: apiKeys.marketcheckKey ? `****${apiKeys.marketcheckKey.slice(-4)}` : null,
          apifyToken: apiKeys.apifyToken ? `****${apiKeys.apifyToken.slice(-4)}` : null,
          geminiApiKey: apiKeys.geminiApiKey ? `****${apiKeys.geminiApiKey.slice(-4)}` : null,
          ghlApiKey: apiKeys.ghlApiKey ? `****${apiKeys.ghlApiKey.slice(-4)}` : null,
          facebookAppSecret: apiKeys.facebookAppSecret ? `****${apiKeys.facebookAppSecret.slice(-4)}` : null,
        };
        res.json(masked);
      } else {
        res.json(null);
      }
    } catch (error) {
      console.error("Error fetching API keys:", error);
      res.status(500).json({ error: "Failed to fetch API keys" });
    }
  });

  // Update dealership API keys - ADMIN ONLY
  app.patch("/api/dealership-api-keys", authMiddleware, requireRole("master"), async (req, res) => {
    try {
      const dealershipId = req.dealershipId!;
      const updates = req.body;

      // Validate that only allowed fields are being updated
      const allowedFields = ['openaiApiKey', 'marketcheckKey', 'apifyToken', 'apifyActorId', 'geminiApiKey', 'ghlApiKey', 'ghlLocationId', 'facebookAppId', 'facebookAppSecret'];
      const invalidFields = Object.keys(updates).filter(key => !allowedFields.includes(key));
      
      if (invalidFields.length > 0) {
        return res.status(400).json({ error: `Invalid fields: ${invalidFields.join(', ')}` });
      }

      // Check if API keys exist for this dealership
      const existing = await storage.getDealershipApiKeys(dealershipId);
      
      let apiKeys;
      if (existing) {
        // Update existing
        apiKeys = await storage.updateDealershipApiKeys(dealershipId, updates);
      } else {
        // Create new
        apiKeys = await storage.saveDealershipApiKeys({
          dealershipId,
          ...updates
        });
      }

      // Mask the response
      if (apiKeys) {
        const masked = {
          ...apiKeys,
          openaiApiKey: apiKeys.openaiApiKey ? `****${apiKeys.openaiApiKey.slice(-4)}` : null,
          marketcheckKey: apiKeys.marketcheckKey ? `****${apiKeys.marketcheckKey.slice(-4)}` : null,
          apifyToken: apiKeys.apifyToken ? `****${apiKeys.apifyToken.slice(-4)}` : null,
          geminiApiKey: apiKeys.geminiApiKey ? `****${apiKeys.geminiApiKey.slice(-4)}` : null,
          ghlApiKey: apiKeys.ghlApiKey ? `****${apiKeys.ghlApiKey.slice(-4)}` : null,
          facebookAppSecret: apiKeys.facebookAppSecret ? `****${apiKeys.facebookAppSecret.slice(-4)}` : null,
        };
        res.json(masked);
      } else {
        res.status(500).json({ error: "Failed to save API keys" });
      }
    } catch (error) {
      console.error("Error updating API keys:", error);
      res.status(500).json({ error: "Failed to update API keys" });
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

      const dealershipId = req.dealershipId!;
      const { GHLClient } = await import("./ghl-client");
      
      // Try dealership-specific client first (uses API keys from database)
      let client = await GHLClient.getInstanceForDealership(dealershipId);
      
      // Fallback to legacy getInstance (uses ghlConfig table)
      if (!client) {
        client = await GHLClient.getInstance();
      }

      if (!client) {
        return res.status(503).json({ 
          error: "GoHighLevel integration not configured. Please configure GHL API key in admin panel." 
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
  
  // Request SMS handoff (sync conversation to GHL via API or webhook) - PUBLIC (user initiates)
  app.post("/api/chat/handoff", async (req, res) => {
    try {
      const { conversationId, phoneNumber, messages, vehicleInfo, category } = req.body;

      if (!conversationId || !phoneNumber || !messages) {
        return res.status(400).json({ error: "conversationId, phoneNumber, and messages are required" });
      }

      const dealershipId = req.dealershipId!;
      let handoffSuccess = false;
      let errorMessage = "";

      // Try GHL API first (preferred method - uses dealership-specific API keys from database)
      const { GHLClient } = await import("./ghl-client");
      const ghlClient = await GHLClient.getInstanceForDealership(dealershipId);
      
      if (ghlClient) {
        try {
          const dealership = await storage.getDealership(dealershipId);
          const result = await ghlClient.syncChatConversation({
            phone: phoneNumber,
            sessionId: conversationId.toString(),
            category: category || 'general',
            vehicleName: vehicleInfo?.vehicleName,
            messages: messages,
            dealershipName: dealership?.name,
          });

          if (result.success) {
            handoffSuccess = true;
            console.log(`[Chat Handoff] Successfully synced to GHL API - Contact: ${result.contactId}`);
          } else {
            errorMessage = result.error || "GHL API sync failed";
            console.warn(`[Chat Handoff] GHL API failed: ${errorMessage}`);
          }
        } catch (apiError) {
          errorMessage = apiError instanceof Error ? apiError.message : "GHL API error";
          console.warn(`[Chat Handoff] GHL API error: ${errorMessage}`);
        }
      }

      // Fallback to webhook if API failed or not configured
      if (!handoffSuccess) {
        const webhookConfig = await storage.getActiveGHLWebhookConfig(dealershipId);
        
        if (webhookConfig) {
          try {
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

            const response = await fetch(webhookConfig.webhookUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            });

            if (response.ok) {
              handoffSuccess = true;
              console.log(`[Chat Handoff] Successfully sent to webhook`);
            } else {
              errorMessage = `Webhook failed with status ${response.status}`;
            }
          } catch (webhookError) {
            errorMessage = webhookError instanceof Error ? webhookError.message : "Webhook error";
          }
        } else if (!ghlClient) {
          return res.status(503).json({ 
            error: "SMS handoff not configured. Please configure GHL API key or webhook in admin panel." 
          });
        }
      }

      // Update conversation with handoff status
      await storage.updateConversationHandoff(conversationId, dealershipId, {
        handoffRequested: true,
        handoffPhone: phoneNumber,
        handoffSent: handoffSuccess,
        handoffSentAt: handoffSuccess ? new Date() : undefined,
      });

      if (handoffSuccess) {
        res.json({ 
          success: true, 
          message: "Conversation handed off to SMS. You'll receive a text shortly!" 
        });
      } else {
        res.status(500).json({ error: errorMessage || "Failed to handoff conversation to SMS" });
      }
    } catch (error) {
      console.error("Error handling SMS handoff:", error);
      
      if (req.body.conversationId) {
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
      const dealershipId = req.dealershipId!;
      
      // Validate request body - only require accountName, dealershipId and userId come from auth
      const validated = insertFacebookAccountSchema.omit({ 
        userId: true, 
        isActive: true, 
        dealershipId: true,
        facebookUserId: true,
        accessToken: true,
        tokenExpiresAt: true
      }).safeParse(req.body);
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
      const dealershipId = req.dealershipId!;
      
      const account = await storage.getFacebookAccountById(accountId, userId, dealershipId);
      if (!account || account.userId !== userId) {
        return res.status(404).json({ error: "Account not found or access denied" });
      }
      
      const state = crypto.randomBytes(32).toString('hex');
      oauthStateStore.set(state, {
        userId,
        accountId,
        dealershipId,
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

      // Use dealershipId from state (not from request) for proper multi-tenant security
      const { accountId, userId, dealershipId } = stateData;
      
      // Runtime check to ensure dealershipId is present (defense in depth)
      if (!dealershipId || typeof dealershipId !== 'number') {
        return res.status(400).send(`
          <html>
            <head><title>Invalid State</title></head>
            <body style="font-family: system-ui; text-align: center; padding: 50px;">
              <h1>✗ Invalid Session Data</h1>
              <p>The session is missing required tenant information. Please try again.</p>
              <button onclick="window.close()">Close</button>
            </body>
          </html>
        `);
      }
      
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

  // Get available Facebook pages from a connected account
  app.get("/api/facebook/accounts/:accountId/pages", authMiddleware, requireRole("salesperson"), async (req, res) => {
    try {
      const authReq = req as AuthRequest;
      const accountId = parseInt(req.params.accountId);
      const userId = authReq.user!.id;
      const dealershipId = req.dealershipId!;
      
      const account = await storage.getFacebookAccountById(accountId, userId, dealershipId);
      if (!account || !account.accessToken) {
        return res.status(400).json({ error: "Account not connected or token missing" });
      }
      
      const pages = await facebookService.getUserPages(account.accessToken);
      
      const formattedPages = pages.map(page => ({
        id: page.id,
        name: page.name,
        category: page.category,
        picture: page.picture?.data?.url,
        hasToken: !!page.access_token
      }));
      
      res.json(formattedPages);
    } catch (error) {
      console.error("Error fetching Facebook pages:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch pages" });
    }
  });

  // Connect a Facebook page (store its access token)
  app.post("/api/facebook/accounts/:accountId/pages/:pageId/connect", authMiddleware, requireRole("salesperson"), async (req, res) => {
    try {
      const authReq = req as AuthRequest;
      const accountId = parseInt(req.params.accountId);
      const pageId = req.params.pageId;
      const userId = authReq.user!.id;
      const dealershipId = req.dealershipId!;
      
      const account = await storage.getFacebookAccountById(accountId, userId, dealershipId);
      if (!account || !account.accessToken) {
        return res.status(400).json({ error: "Account not connected" });
      }
      
      const pages = await facebookService.getUserPages(account.accessToken);
      const page = pages.find(p => p.id === pageId);
      
      if (!page) {
        return res.status(404).json({ error: "Page not found or you don't have access" });
      }
      
      const existingPage = await storage.getFacebookPageByPageId(pageId);
      if (existingPage) {
        await storage.updateFacebookPage(existingPage.id, {
          accessToken: page.access_token,
          isActive: true,
          pageName: page.name
        });
        return res.json({ 
          success: true, 
          message: "Page reconnected successfully",
          page: { id: existingPage.id, pageId, name: page.name }
        });
      }
      
      const newPage = await storage.createFacebookPage({
        dealershipId,
        pageName: page.name,
        pageId: page.id,
        accessToken: page.access_token,
        isActive: true,
        selectedTemplate: 'modern'
      });
      
      res.json({ 
        success: true, 
        message: "Page connected successfully",
        page: { id: newPage.id, pageId: newPage.pageId, name: newPage.pageName }
      });
    } catch (error) {
      console.error("Error connecting Facebook page:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to connect page" });
    }
  });

  // Disconnect a Facebook page
  app.post("/api/facebook/pages/:pageId/disconnect", authMiddleware, requireRole("salesperson"), async (req, res) => {
    try {
      const pageId = parseInt(req.params.pageId);
      const dealershipId = req.dealershipId!;
      
      await storage.updateFacebookPage(pageId, { isActive: false, accessToken: null });
      
      res.json({ success: true, message: "Page disconnected" });
    } catch (error) {
      console.error("Error disconnecting Facebook page:", error);
      res.status(500).json({ error: "Failed to disconnect page" });
    }
  });

  // Get connected Facebook pages for the dealership
  app.get("/api/facebook/connected-pages", authMiddleware, async (req, res) => {
    try {
      const dealershipId = req.dealershipId!;
      const pages = await storage.getFacebookPages(dealershipId);
      
      // Explicitly exclude sensitive token data from response
      const safePages = pages.map(({ accessToken, ...page }) => ({
        ...page,
        hasValidToken: !!accessToken
      }));
      
      res.json(safePages);
    } catch (error) {
      console.error("Error fetching connected pages:", error);
      res.status(500).json({ error: "Failed to fetch connected pages" });
    }
  });

  // Test post to a Facebook page
  app.post("/api/facebook/pages/:pageId/test-post", authMiddleware, requireRole("master"), async (req, res) => {
    try {
      const pageId = parseInt(req.params.pageId);
      const dealershipId = req.dealershipId!;
      const { message } = req.body;
      
      const pages = await storage.getFacebookPages(dealershipId);
      const page = pages.find(p => p.id === pageId);
      
      if (!page || !page.accessToken) {
        return res.status(400).json({ error: "Page not connected or token missing" });
      }
      
      const result = await facebookService.postToPage(
        page.accessToken,
        page.pageId,
        message || `Test post from Olympic Auto Group - ${new Date().toLocaleString()}`
      );
      
      res.json({ success: true, postId: result.postId });
    } catch (error) {
      console.error("Error posting to Facebook page:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to post" });
    }
  });

  // Post a vehicle to a Facebook page
  app.post("/api/facebook/pages/:pageId/post-vehicle/:vehicleId", authMiddleware, requireRole("salesperson"), async (req, res) => {
    try {
      const pageId = parseInt(req.params.pageId);
      const vehicleId = parseInt(req.params.vehicleId);
      const dealershipId = req.dealershipId!;
      
      const pages = await storage.getFacebookPages(dealershipId);
      const page = pages.find(p => p.id === pageId);
      
      if (!page || !page.accessToken) {
        return res.status(400).json({ error: "Page not connected or token missing" });
      }
      
      const vehicle = await storage.getVehicleById(vehicleId, dealershipId);
      if (!vehicle) {
        return res.status(404).json({ error: "Vehicle not found" });
      }
      
      const result = await facebookService.postVehicleToPage(
        page.accessToken,
        page.pageId,
        {
          year: vehicle.year,
          make: vehicle.make,
          model: vehicle.model,
          trim: vehicle.trim,
          price: vehicle.price,
          odometer: vehicle.odometer,
          images: vehicle.images,
          dealerVdpUrl: vehicle.dealerVdpUrl || undefined,
          description: vehicle.description
        }
      );
      
      res.json({ success: true, postId: result.postId, vehicleId });
    } catch (error) {
      console.error("Error posting vehicle to Facebook:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to post vehicle" });
    }
  });

  // Manually post a vehicle to Facebook Marketplace
  app.post("/api/facebook/post/:queueId", authMiddleware, requireRole("salesperson"), async (req, res) => {
    try {
      const authReq = req as AuthRequest;
      const queueId = parseInt(req.params.queueId);
      const userId = authReq.user!.id;
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
      
      // Get market listings from database (no pagination - need full dataset for analytics)
      let { listings: marketListings } = await storage.getMarketListings(dealershipId, {
        make,
        model,
        yearMin: searchYearMin,
        yearMax: searchYearMax
      }, 10000, 0);

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
      const dealershipId = req.dealershipId!;
      // Get all market listings to populate makes
      const { listings: marketListings } = await storage.getMarketListings(dealershipId, {}, 10000, 0);
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
      const dealershipId = req.dealershipId!;
      const { make } = req.query;
      const { listings: marketListings } = await storage.getMarketListings(dealershipId, {}, 10000, 0);
      
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
      const dealershipId = req.dealershipId!;
      const { make, model } = req.query;
      const { listings: marketListings } = await storage.getMarketListings(dealershipId, {}, 10000, 0);
      
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
      // Single-dealership mode: Tenant middleware defaults to dealershipId=1
      // Multi-tenant expansion: Parse dealershipId from webhook URL path (e.g., /api/pbs/webhook/:dealershipId) or custom header
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
  
  // ===== WEBSOCKET SERVER FOR REAL-TIME NOTIFICATIONS =====
  const WebSocket = await import('ws');
  const wss = new WebSocket.WebSocketServer({ server: httpServer, path: '/ws' });
  
  // Store connected clients by dealership with authenticated user info
  interface AuthenticatedClient {
    ws: InstanceType<typeof WebSocket.WebSocket>;
    userId: number;
    dealershipId: number;
  }
  const clientsByDealership = new Map<number, Set<AuthenticatedClient>>();
  
  wss.on('connection', async (ws: InstanceType<typeof WebSocket.WebSocket>, req) => {
    // SECURITY: Authenticate WebSocket connection using JWT token
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const token = url.searchParams.get('token');
    
    if (!token) {
      ws.close(4001, 'Authentication required');
      return;
    }
    
    try {
      // Verify JWT token and get user info
      const decoded = verifyToken(token);
      if (!decoded || !decoded.id) {
        ws.close(4001, 'Invalid token');
        return;
      }
      
      // Verify user is still active
      const user = await storage.getUserById(decoded.id);
      if (!user || !user.isActive) {
        ws.close(4001, 'User not found or inactive');
        return;
      }
      
      // Use the dealership ID from the user's token, not from query params
      // This ensures tenant isolation - users can only subscribe to their own dealership
      const dealershipId = user.dealershipId || 1; // Super admins default to dealership 1
      
      const client: AuthenticatedClient = {
        ws,
        userId: user.id,
        dealershipId,
      };
      
      // Add to dealership clients
      if (!clientsByDealership.has(dealershipId)) {
        clientsByDealership.set(dealershipId, new Set());
      }
      clientsByDealership.get(dealershipId)!.add(client);
      
      console.log(`WebSocket client connected: user ${user.id} for dealership ${dealershipId}`);
      
      ws.on('close', () => {
        clientsByDealership.get(dealershipId)?.delete(client);
        console.log(`WebSocket client disconnected: user ${user.id} for dealership ${dealershipId}`);
      });
      
      ws.on('error', (error: Error) => {
        console.error('WebSocket error:', error);
      });
    } catch (error) {
      console.error('WebSocket authentication error:', error);
      ws.close(4001, 'Authentication failed');
    }
  });
  
  // Notification payload schema for validation
  const NotificationSchema = {
    validate: (data: any): data is {
      type: 'new_lead' | 'chat_message' | 'post_status' | 'inventory_sync' | 'system';
      title: string;
      message: string;
      data?: any;
      timestamp: string;
    } => {
      const validTypes = ['new_lead', 'chat_message', 'post_status', 'inventory_sync', 'system'];
      return (
        typeof data === 'object' &&
        data !== null &&
        validTypes.includes(data.type) &&
        typeof data.title === 'string' &&
        typeof data.message === 'string' &&
        typeof data.timestamp === 'string'
      );
    }
  };
  
  // Broadcast notification to all authenticated clients for a dealership
  const broadcastNotification = (dealershipId: number, notification: {
    type: 'new_lead' | 'chat_message' | 'post_status' | 'inventory_sync' | 'system';
    title: string;
    message: string;
    data?: any;
    timestamp: string;
  }) => {
    // Validate notification payload
    if (!NotificationSchema.validate(notification)) {
      console.error('Invalid notification payload:', notification);
      return;
    }
    
    // Validate dealership ID
    if (typeof dealershipId !== 'number' || isNaN(dealershipId) || dealershipId < 1) {
      console.error('Invalid dealership ID for broadcast:', dealershipId);
      return;
    }
    
    const clients = clientsByDealership.get(dealershipId);
    if (!clients || clients.size === 0) return;
    
    const payload = JSON.stringify(notification);
    clients.forEach(client => {
      if (client.ws.readyState === WebSocket.WebSocket.OPEN) {
        client.ws.send(payload);
      }
    });
  };
  
  // Expose broadcast function globally for use in other routes
  (global as any).broadcastNotification = broadcastNotification;
  
  return httpServer;
}
