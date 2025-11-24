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
- Remarketing vehicle selection (CRUD operations with priority management)
- PBS DMS integration (config management, webhook receiver, event monitoring)
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

**Remarketing System (November 2025):**
10. **remarketing_vehicles** - Selected vehicles for remarketing campaigns
    - Vehicle ID foreign key
    - Budget priority (1-5 stars for ad spend allocation)
    - Active status for soft delete functionality
    - Created/updated timestamps
    - 20-vehicle limit enforced at application layer
    - Duplicate prevention for active records

**PBS DMS Integration (November 2025):**
11. **pbs_config** - PBS Partner Hub API configuration
    - Partner ID, API credentials (username/password)
    - PBS API URL and webhook settings (optional)
    - Webhook secret for HMAC-SHA256 signature validation
    - Active status for connection control
    - Single configuration per system

12. **pbs_webhook_events** - Webhook event log from PBS
    - Event type and ID for tracking
    - Full JSON payload storage
    - Status tracking (pending/processed/failed)
    - Error message for failed events
    - Received/processed timestamps
    
**PBS Webhook Security (November 2025):**
- HMAC-SHA256 signature validation using webhook secret
- Timestamp validation (5-minute window) to prevent replay attacks
- Timing-safe comparison to prevent timing attacks
- Proper error responses (401 Unauthorized, 403 Forbidden)
- Public endpoint at `/api/pbs/webhook` secured with signature verification

**Legacy Tables (Deprecated):**
13. **facebook_pages** - Legacy social media integration
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

**Sales Manager Tools (November 2025):**
- **VIN Decoder**: NHTSA API integration to decode 17-character VINs and retrieve comprehensive vehicle specifications
- **Market Pricing Analysis - Enterprise-Grade Three-Tier Data Strategy (November 24, 2025)**: 
  - **Architecture**: Intelligent data aggregation from multiple sources with automatic failover and deduplication
  - **Primary Source - MarketCheck API** (enterprise-grade, requires API key via MARKETCHECK_API_KEY secret):
    - Comprehensive Canadian dealer and private party listings
    - Clean structured data with lat/lon coordinates for radius searches
    - Professional market intelligence trusted by dealerships
    - Configurable in Replit Secrets, graceful degradation if not configured
  - **Secondary Source - Apify AutoTrader.ca Actor** (managed scraping, requires APIFY_API_TOKEN secret):
    - Enterprise web scraping platform with quality guarantees
    - Canada's largest automotive marketplace coverage
    - Automatic retries and browser automation infrastructure
    - Configurable actor ID via APIFY_AUTOTRADER_ACTOR_ID secret (defaults to 'fayoussef/autotrader-canada')
  - **Fallback Source - Puppeteer Scraper** (free, always available):
    - Direct AutoTrader.ca scraping using Chromium
    - Activates automatically when premium sources unavailable or return <20 listings
    - 2024 URL format with robust selector-based extraction
  - **Data Aggregation Service** (`server/market-aggregation-service.ts`):
    - Orchestrates all three sources in priority order
    - Intelligent deduplication using listing URLs across sources
    - Batch database checking to prevent duplicate inserts
    - Race condition handling with unique constraint error catching
    - Comprehensive error reporting and source breakdown metrics
  - **Canadian postal code geocoding** via Geocoder.ca API (lat/lon conversion, distance calculation)
  - **Manager settings storage** (postal code, default search radius in KM)
  - **Market listings cache** with source tracking (marketcheck/apify/autotrader_scraper), listing type (dealer/private), posted date
  - **Multi-trim and flexible year range support** in pricing API
  - **Safe SQL filtering** with case-insensitive matching
  - **Manual scrape trigger endpoint** (`POST /api/manager/scrape-market`) with detailed source breakdown
  - **UI Complete (November 24, 2025)**: 
    - Settings panel with Canadian postal code validation and radius configuration
    - Year range inputs (min/max) replacing single year field
    - Multi-trim selector with badges for comparing multiple trims
    - "Refresh Market Data" button triggering enterprise data aggregation
    - Enhanced results display showing data sources, year ranges, radius, and location metadata
    - Full validation preventing searches without postal code configuration
  - **Technical Debt**: Distance filtering not yet implemented (geocoding ready), scraper should run in background job queue, no mileage adjustment or source weighting in pricing algorithm

**Cron Scheduling:**
- Node-cron for scheduled inventory synchronization tasks
- Configurable sync intervals (default: daily at 2:00 AM)