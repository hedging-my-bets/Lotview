# Olympic Auto Group - Digital Flagship Inventory System

## Overview

This is a full-stack vehicle inventory management system for Olympic Auto Group dealerships. The application allows customers to browse vehicle inventory across multiple dealership locations (Olympic Hyundai Vancouver, Boundary Hyundai Vancouver, and Kia Vancouver), view detailed vehicle information, and calculate financing options. The system includes automated inventory synchronization through web scraping, view tracking for remarketing purposes, and a chatbot interface for customer engagement.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & Build System:**
- React 18 with TypeScript for type-safe component development
- Vite as the build tool and development server, configured for hot module replacement
- Wouter for lightweight client-side routing
- TanStack Query (React Query) for server state management and caching

**UI Component Library:**
- Shadcn UI (New York style) with Radix UI primitives for accessible component foundations
- Tailwind CSS v4 for utility-first styling with custom design tokens
- Custom CSS variables for theming (brand colors: #022d60 dark, #00aad2 light)
- Lucide React for iconography

**Key Design Decisions:**
- Component-based architecture with reusable UI primitives in `client/src/components/ui/`
- Custom filtering system for inventory with support for type, price, location, and dealership filters
- Real-time financing calculator with multiple term options (36, 48, 60, 72, 84 months)
- Session-based view tracking for remarketing purposes

### Backend Architecture

**Server Framework:**
- Express.js with TypeScript for type-safe API development
- Separate development (`server/index-dev.ts`) and production (`server/index-prod.ts`) entry points
- Custom middleware for request logging with response capture

**API Design:**
- RESTful API endpoints under `/api` prefix
- Vehicle CRUD operations with view tracking
- Authentication endpoints (login, logout, session management)
- User management (master users only)
- Financing rules management (credit score tiers, model year terms)
- Facebook posting system (accounts, templates, queue, schedule)
- Manual sync trigger endpoint for on-demand inventory updates

**Security Architecture:**
- JWT authentication with httpOnly cookies
- Role-based access control (RBAC) middleware
- Multi-tenant data isolation with userId foreign keys
- Ownership enforcement at storage layer (WHERE clause scoping)
- Input validation with Zod schemas on all endpoints
- Foreign key ownership verification to prevent cross-user resource hijacking
- PATCH payload sanitization to prevent field injection attacks
- Defense-in-depth security with multiple validation layers

**Data Access Layer:**
- Storage abstraction pattern with `IStorage` interface for database operations
- Drizzle ORM for type-safe database queries
- PostgreSQL as the primary database (via Neon serverless)

**Scheduled Jobs:**
- Cron-based inventory synchronization running daily at 2:00 AM
- Manual sync capability for immediate updates
- Web scraping service using Cheerio for extracting vehicle data from dealer websites

### Database Schema

**Core Tables:**
1. **vehicles** - Core inventory data
   - Vehicle specifications (year, make, model, trim, type)
   - Pricing and odometer information
   - Image URLs and badge arrays
   - Location and dealership assignment
   - Descriptive content

2. **vehicle_views** - Remarketing tracking
   - Vehicle ID foreign key
   - Session ID for user tracking
   - Timestamp for view analytics

**User Management (November 2025):**
3. **users** - System users with role-based access
   - Email and hashed password authentication
   - Role (master/manager/salesperson)
   - Active status tracking
   - Created/updated timestamps

**Financing Rules (November 2025):**
4. **credit_score_tiers** - Interest rate rules by credit score
   - Credit score ranges (min/max)
   - Interest rates for each tier
   - Active status for enabling/disabling rules

5. **model_year_terms** - Financing term eligibility by vehicle age
   - Model year ranges (min/max)
   - Available term lengths (array of months)
   - Active status for rule management

**Facebook Posting System (November 2025):**
6. **facebook_accounts** - Salesperson Facebook accounts (up to 5 per user)
   - Account credentials and OAuth tokens
   - Token expiration tracking
   - User ownership with foreign key

7. **ad_templates** - Custom posting templates with dynamic variables
   - Template name and content (title/description)
   - Default template flag
   - User ownership for multi-tenant isolation

8. **posting_queue** - Vehicle posting queue with priority ordering
   - Vehicle, account, and template references
   - Queue order for sequential posting
   - Status tracking (queued/posting/posted/failed)
   - User ownership enforcement

9. **posting_schedule** - Per-user automated posting configuration
   - Start time and interval settings
   - Active status for schedule control
   - One schedule per salesperson

**Legacy Tables (Deprecated):**
10. **facebook_pages** - Legacy social media integration
11. **page_priority_vehicles** - Legacy featured vehicle management

**Schema Management:**
- Drizzle Kit for migrations stored in `/migrations`
- Zod schemas generated from Drizzle schemas for runtime validation
- Type inference for full type safety across the stack

### Development Workflow

**Development Mode:**
- Vite middleware integration for hot module replacement
- HTML template transformation for SSR-like behavior
- Replit-specific plugins (cartographer, dev banner, runtime error overlay)

**Production Mode:**
- Static file serving from compiled `/dist/public` directory
- Server bundled with esbuild for optimized deployment
- Environment-specific configuration through NODE_ENV

**Code Organization:**
- Monorepo structure with shared types in `/shared`
- Path aliases for clean imports (`@/`, `@shared/`, `@assets/`)
- Strict TypeScript configuration with ESNext modules

## External Dependencies

**Database:**
- Neon Serverless PostgreSQL via `@neondatabase/serverless`
- Connection string required via `DATABASE_URL` environment variable

**Web Scraping:**
- Cheerio for HTML parsing of dealership inventory pages
- Target dealerships: Olympic Hyundai Vancouver, Boundary Hyundai Vancouver, Kia Vancouver
- Badge detection system for special vehicle features (One Owner, No Accidents, Certified Pre-Owned, etc.)

**Build & Development Tools:**
- Replit-specific Vite plugins for development environment integration
- Custom meta images plugin for OpenGraph/Twitter card image URL rewriting
- Font Awesome CDN for icon support
- Google Fonts (Inter) for typography

**Styling & UI:**
- Tailwind CSS with PostCSS for CSS processing
- Autoprefixer for browser compatibility
- Custom Tailwind v4 configuration with inline theme definitions

**Authentication & Authorization:**
- JWT-based authentication with httpOnly cookies for security
- Three user roles: master (full system control), manager (VIN decoder and market pricing), salesperson (Facebook posting)
- Role-based access control (RBAC) with middleware enforcement
- Secure password hashing with bcrypt
- Session-based view tracking for anonymous users (vehicle remarketing)

**Cron Scheduling:**
- Node-cron for scheduled inventory synchronization tasks
- Configurable sync intervals (default: daily at 2:00 AM)