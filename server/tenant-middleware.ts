/**
 * Multi-Tenant Middleware
 * 
 * Extracts dealership context from:
 * 1. Authenticated user's dealershipId
 * 2. Subdomain (e.g., olympic.yourdomain.com)
 * 3. Custom header (X-Dealership-Id) for API integrations
 * 
 * Sets req.dealershipId for use in controllers and storage methods
 */

import { Request, Response, NextFunction } from 'express';

// Extend Express Request type to include dealership context
declare global {
  namespace Express {
    interface Request {
      dealershipId?: number;
      dealership?: {
        id: number;
        name: string;
        slug: string;
        subdomain?: string;
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
      
      // Strategy 1: Get dealership from authenticated user
      if (req.user) {
        const user = req.user as any;
        
        // Master users can access all dealerships, so they don't have a fixed dealershipId
        // For master users, we'll use other methods to determine context
        if (user.role !== 'master' && user.dealershipId) {
          dealershipId = user.dealershipId;
        }
        
        // If master user and no other context, we'll handle this in individual routes
        // Master users will need to specify dealership via query param or access all
      }
      
      // Strategy 2: Extract from subdomain (if not already set)
      if (!dealershipId) {
        const subdomain = extractDealershipFromSubdomain(req.hostname);
        
        if (subdomain) {
          // Look up dealership by subdomain
          const dealership = await storage.getDealershipBySubdomain(subdomain);
          if (dealership) {
            dealershipId = dealership.id;
            req.dealership = dealership;
          }
        }
      }
      
      // Strategy 3: Check for custom header (for API integrations)
      if (!dealershipId && req.headers['x-dealership-id']) {
        const headerDealershipId = parseInt(req.headers['x-dealership-id'] as string);
        if (!isNaN(headerDealershipId)) {
          dealershipId = headerDealershipId;
        }
      }
      
      // Strategy 4: Default to Olympic Auto Group (ID: 1) if no context found
      // This provides backward compatibility for existing deployments
      if (!dealershipId) {
        dealershipId = 1; // Default to first dealership
      }
      
      // Set dealership ID in request context
      req.dealershipId = dealershipId;
      
      // If we haven't loaded the dealership details yet, load them
      if (!req.dealership && dealershipId) {
        const dealership = await storage.getDealership(dealershipId);
        if (dealership) {
          req.dealership = dealership;
        }
      }
      
      next();
    } catch (error) {
      console.error('Tenant middleware error:', error);
      // Continue anyway with default dealership to avoid breaking the app
      req.dealershipId = 1;
      next();
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
