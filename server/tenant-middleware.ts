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
            // For single-dealership mode, default to dealershipId=1
            dealershipId = 1;
            source = 'default';
            req.user = {
              id: decoded.id,
              email: decoded.email,
              role: decoded.role,
              name: decoded.name,
              dealershipId: 1
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
            } else if (authHeader) {
              // Authenticated request with invalid subdomain - fail closed
              return res.status(404).json({ error: `Dealership not found for subdomain: ${subdomain}` });
            }
          } catch (error) {
            // Subdomain lookup failed
            if (authHeader) {
              // Authenticated request with subdomain lookup error - fail closed
              console.error('Subdomain lookup error:', error);
              return res.status(500).json({ error: 'Failed to resolve dealership from subdomain' });
            }
            // Public request - will fall through to default
          }
        }
      }
      
      // Strategy 3: Check for custom header (for API integrations)
      if (!dealershipId && req.headers['x-dealership-id']) {
        const headerDealershipId = parseInt(req.headers['x-dealership-id'] as string);
        if (!isNaN(headerDealershipId)) {
          dealershipId = headerDealershipId;
          source = 'header';
        }
      }
      
      // Strategy 4: Handle missing dealership context - DUAL PATH STRATEGY
      // - If NO auth header: default to dealershipId=1 (public access for single-dealership mode)
      // - If auth header present but cannot resolve dealership: fail closed with 401/400
      if (!dealershipId) {
        if (!authHeader) {
          // Public request with no tenant hints - default to single-dealership mode
          dealershipId = 1;
          source = 'default';
        } else if (tokenInvalid) {
          // Invalid/expired token - fail closed with 401
          return res.status(401).json({ error: 'Invalid or expired token' });
        } else {
          // Auth header present but dealershipId couldn't be resolved - fail closed
          return res.status(400).json({ error: 'Could not determine dealership context from authentication' });
        }
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
      // For single-dealership mode, fall back to dealershipId=1 ONLY for public requests
      if (!req.dealershipId && !req.headers.authorization) {
        req.dealershipId = 1;
        req.tenantSource = 'default';
        return next();
      }
      // Authenticated requests with errors fail closed
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
  
  // Master users can access all dealerships
  if (user.role === 'master') {
    return next();
  }
  
  // Non-master users can only access their own dealership
  if (user.dealershipId === targetDealershipId) {
    return next();
  }
  
  return res.status(403).json({ error: 'Access denied. You can only access your own dealership data.' });
}
