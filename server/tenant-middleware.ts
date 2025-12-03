/**
 * Multi-Tenant Middleware
 * 
 * Extracts dealership context from:
 * 1. JWT token (if present in Authorization header)
 * 2. Subdomain (e.g., olympic.yourdomain.com)
 * 3. Custom header (X-Dealership-Id) for API integrations
 * 
 * Sets req.dealershipId for use in controllers and storage methods
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// JWT secret (same as auth.ts)
const JWT_SECRET = process.env.JWT_SECRET || "olympic-auto-jwt-dev-secret-DO-NOT-USE-IN-PRODUCTION";

// Tenant resolution sources for tracking and debugging
type TenantResolutionSource = 'jwt' | 'subdomain' | 'header' | 'default' | 'none';

// Extend Express Request type to include dealership context and user
declare global {
  namespace Express {
    interface Request {
      dealershipId?: number;
      tenantSource?: TenantResolutionSource;
      dealership?: {
        id: number;
        name: string;
        slug: string;
        subdomain?: string;
      };
      user?: {
        id: number;
        email: string;
        role: string;
        name: string;
        dealershipId?: number | null;
      };
    }
  }
}

/**
 * Extract dealership ID from subdomain
 * Example: olympic.inv.replit.app -> looks up dealership by subdomain "olympic"
 */
function extractDealershipFromSubdomain(hostname: string): string | null {
  // Remove port if present
  const host = hostname.split(':')[0];
  
  // Check if this is a subdomain format
  const parts = host.split('.');
  
  // If we have at least 3 parts (subdomain.domain.tld), extract subdomain
  if (parts.length >= 3 && parts[0] !== 'www') {
    return parts[0];
  }
  
  return null;
}

/**
 * Tenant context middleware - extracts and sets dealership ID
 */
export function tenantMiddleware(storage: any) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      let dealershipId: number | undefined;
      let source: TenantResolutionSource = 'none';
      
      // Strategy 1: Extract dealership from JWT token (if present)
      const authHeader = req.headers.authorization;
      let tokenInvalid = false;
      if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.substring(7);
        try {
          const decoded = jwt.verify(token, JWT_SECRET) as any;
          
          // Super admin handling: set user context but DON'T return early
          // Allow the middleware to continue to Strategy 3 (header-based selection)
          if (decoded && decoded.role === 'super_admin') {
            req.user = {
              id: decoded.id,
              email: decoded.email,
              role: decoded.role,
              name: decoded.name,
              dealershipId: null
            };
            // Don't set dealershipId yet - let Strategy 3 handle X-Dealership-Id header
            // Don't return early - continue through middleware
          }
          
          if (decoded && decoded.dealershipId) {
            dealershipId = decoded.dealershipId;
            source = 'jwt';
            
            // Set req.user for convenience (will be overwritten by authMiddleware later)
            req.user = {
              id: decoded.id,
              email: decoded.email,
              role: decoded.role,
              name: decoded.name,
              dealershipId: decoded.dealershipId
            };
          } else if (decoded && !decoded.dealershipId) {
            // Valid token but missing dealershipId (legacy token)
            // SECURITY: Reject legacy tokens without dealershipId - they must re-authenticate
            // Exception: Allow super_admin and master roles to proceed (they select dealership via header)
            if (decoded.role !== 'super_admin' && decoded.role !== 'master') {
              return res.status(401).json({ 
                error: 'Session expired. Please log in again.',
                code: 'LEGACY_TOKEN_REJECTED'
              });
            }
            // For super_admin/master, set user but leave dealershipId undefined (will use header later)
            req.user = {
              id: decoded.id,
              email: decoded.email,
              role: decoded.role,
              name: decoded.name,
              dealershipId: null
            };
          }
        } catch (error) {
          // Invalid/expired token - mark for later handling
          // authMiddleware will return proper 401 error
          tokenInvalid = true;
        }
      }
      
      // Strategy 2: Extract from subdomain (if not already set)
      if (!dealershipId) {
        const subdomain = extractDealershipFromSubdomain(req.hostname);
        
        if (subdomain) {
          try {
            // Look up dealership by subdomain
            const dealership = await storage.getDealershipBySubdomain(subdomain);
            if (dealership) {
              dealershipId = dealership.id;
              source = 'subdomain';
              req.dealership = dealership;
            } else {
              // SECURITY: Fail closed for unknown subdomains (prevents cross-tenant exposure)
              // This applies to both authenticated and public requests
              return res.status(404).json({ error: `Dealership not found for subdomain: ${subdomain}` });
            }
          } catch (error) {
            // Subdomain lookup failed - fail closed
            console.error('Subdomain lookup error:', error);
            return res.status(500).json({ error: 'Failed to resolve dealership from subdomain' });
          }
        }
      }
      
      // Strategy 3: Check for custom header (for authenticated API integrations only)
      // SECURITY: Only honor X-Dealership-Id header when authenticated to prevent header spoofing
      if (!dealershipId && req.headers['x-dealership-id'] && authHeader) {
        const headerDealershipId = parseInt(req.headers['x-dealership-id'] as string);
        if (!isNaN(headerDealershipId)) {
          // Only allow super_admin or master users to switch dealership context via header
          const user = req.user;
          if (user && (user.role === 'super_admin' || user.role === 'master')) {
            dealershipId = headerDealershipId;
            source = 'header';
          }
        }
      }
      
      // Strategy 4: Handle missing dealership context - FAIL CLOSED
      // SaaS mode: dealership context is required; no default fallback
      if (!dealershipId) {
        if (tokenInvalid) {
          // Invalid/expired token - fail closed with 401
          return res.status(401).json({ error: 'Invalid or expired token' });
        } else if (authHeader) {
          // Auth header present but dealershipId couldn't be resolved
          // Exception: super_admin and master users can proceed without dealership context
          // (they select dealership in their dashboard UI or via explicit header)
          const user = req.user;
          if (user && (user.role === 'super_admin' || user.role === 'master')) {
            // Allow super_admin/master to proceed - dealershipId stays undefined
            // Routes that need dealership context should handle this appropriately
            source = 'none';
          } else {
            // Regular authenticated user without dealership context - fail closed
            return res.status(400).json({ error: 'Could not determine dealership context from authentication' });
          }
        }
        // Public request without subdomain - leave dealershipId undefined
        // Routes that need dealership context will return 400
        // This allows marketing site pages (landing, login) to work without dealership context
        source = 'none';
      }
      
      // Set dealership ID and source in request context
      if (dealershipId) {
        req.dealershipId = dealershipId;
        req.tenantSource = source;
        
        // Load dealership details if not already loaded
        if (!req.dealership) {
          try {
            const dealership = await storage.getDealership(dealershipId);
            if (dealership) {
              req.dealership = dealership;
            }
          } catch (error) {
            console.error('Failed to load dealership details:', error);
            // Don't fail the request - continue without dealership details
          }
        }
      }
      
      next();
    } catch (error) {
      console.error('Tenant middleware error:', error);
      // SECURITY: Always fail closed on errors (no silent fallback to dealership 1)
      return res.status(500).json({ error: 'Tenant resolution failed' });
    }
  };
}

/**
 * Require dealership context - fails if no dealership can be determined
 * Use this for routes that absolutely need dealership context
 */
export function requireDealership(req: Request, res: Response, next: NextFunction) {
  if (!req.dealershipId) {
    return res.status(400).json({
      error: 'No dealership context found. Please specify via subdomain or authentication.'
    });
  }
  next();
}

/**
 * Super admin only middleware - requires authenticated super_admin user
 */
export function superAdminOnly(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  const user = req.user as any;
  if (user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Super admin access required' });
  }
  
  next();
}

/**
 * Master user only middleware - requires authenticated master user
 */
export function masterOnly(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  const user = req.user as any;
  if (user.role !== 'master') {
    return res.status(403).json({ error: 'Master user access required' });
  }
  
  next();
}

/**
 * Dealership owner or master middleware - allows access to dealership data
 * by dealership owners or master users
 */
export function dealershipOwnerOrMaster(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  const user = req.user as any;
  const targetDealershipId = req.dealershipId || parseInt(req.params.dealershipId) || parseInt(req.query.dealershipId as string);
  
  // Super admins and master users can access all dealerships
  if (user.role === 'super_admin' || user.role === 'master') {
    return next();
  }
  
  // Non-master users can only access their own dealership
  if (user.dealershipId === targetDealershipId) {
    return next();
  }
  
  return res.status(403).json({ error: 'Access denied. You can only access your own dealership data.' });
}
