import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import type { User } from "@shared/schema";

// JWT_SECRET must be set in production for security
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET && process.env.NODE_ENV === "production") {
  throw new Error("JWT_SECRET environment variable is required in production");
}
// Development fallback
const SECRET = JWT_SECRET || "olympic-auto-jwt-dev-secret-DO-NOT-USE-IN-PRODUCTION";
const JWT_EXPIRES_IN = "7d";

export interface AuthRequest extends Request {
  user?: {
    id: number;
    email: string;
    role: string;
    name: string;
    dealershipId?: number | null;
  };
}

export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, 10);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}

export function generateToken(user: User): string {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      dealershipId: user.dealershipId,
    },
    SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

export function verifyToken(token: string): any {
  try {
    return jwt.verify(token, SECRET);
  } catch (error) {
    return null;
  }
}

export async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided" });
  }

  const token = authHeader.substring(7);
  const decoded = verifyToken(token);

  if (!decoded) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  // SECURITY: Verify user status in database to prevent stale token usage
  // This prevents inactive users or role-changed users from accessing protected routes
  try {
    // Use dynamic import to avoid circular dependency (storage.ts imports hashPassword from this file)
    const storageModule = await import("./storage");
    const user = await storageModule.storage.getUserById(decoded.id);
    
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }
    
    if (!user.isActive) {
      return res.status(403).json({ error: "Account is deactivated" });
    }
    
    // Update req.user with fresh data from database (prevents stale role/permissions)
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      dealershipId: user.dealershipId
    };
    
    next();
  } catch (error) {
    console.error("Error validating user:", error);
    return res.status(500).json({ error: "Authentication failed" });
  }
}

export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }

    next();
  };
}
