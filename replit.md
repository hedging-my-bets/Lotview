# Olympic Auto Group - Digital Flagship Inventory System

## Overview
This project is a full-stack vehicle inventory management system for Olympic Auto Group dealerships, encompassing Olympic Hyundai Vancouver, Boundary Hyundai Vancouver, and Kia Vancouver. It enables customers to browse vehicle inventory, view detailed information, and calculate financing options across multiple locations. Key capabilities include automated inventory synchronization via web scraping, view tracking for remarketing, and a chatbot for customer engagement. The system is designed to be production-ready for single dealerships and is built with a multi-tenant architecture to support future expansion.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Frameworks**: React 18 with TypeScript, Vite for build and development, Wouter for routing, TanStack Query for server state management.
- **UI/UX**: Shadcn UI (New York style) with Radix UI, Tailwind CSS v4 for styling with custom design tokens, custom CSS variables for branding (#022d60 dark, #00aad2 light), Lucide React for iconography.
- **Design Decisions**: Component-based architecture, custom filtering for inventory, real-time financing calculator, session-based view tracking.

### Backend Architecture
- **Server**: Express.js with TypeScript, separate dev/prod entry points, custom request logging middleware.
- **API Design**: RESTful API (`/api`) for vehicle CRUD, authentication, user management, financing rules, Facebook posting, remarketing, and PBS DMS integration. Backward-compatible pagination (opt-in via `?page` query param).
- **Multi-Tenancy**: Pool Model architecture with shared tables, `dealership_id` filtering at storage layer. Dual-path tenant resolution (JWT → subdomain → header → default=1) with fail-closed security. `requireDealership` guards on high-risk routes (vehicle writes, user management, video generation).
- **Security**: JWT authentication with httpOnly cookies, Role-Based Access Control (RBAC), multi-tenant data isolation via `dealership_id` and `userId` foreign keys, Zod schema validation, PATCH payload sanitization, defense-in-depth security.
- **Data Access**: Storage abstraction with `IStorage` interface, Drizzle ORM for type-safe queries, PostgreSQL (Neon serverless). All queries filtered by `dealership_id`.
- **Pagination**: Opt-in pagination for vehicles, conversations, market listings via `?page` query param. Returns array by default (backward compatible), returns `{data, pagination}` when paginated. Analytics routes explicitly fetch full datasets (limit=10000).
- **Scheduled Jobs**: Cron-based inventory synchronization (daily at 2:00 AM), manual sync capability, web scraping with Cheerio.

### Database Schema
- **Core Tables**: `vehicles` (inventory), `vehicle_views` (remarketing tracking).
- **User Management**: `users` (system users with roles).
- **Financing Rules**: `credit_score_tiers` (interest rates in basis points: 699 = 6.99%), `model_year_terms` (financing term eligibility).
- **Facebook Posting**: `facebook_accounts`, `ad_templates`, `posting_queue`, `posting_schedule`.
- **Remarketing**: `remarketing_vehicles` (selected vehicles for campaigns).
- **PBS DMS Integration**: `pbs_config` (API configuration), `pbs_webhook_events` (event log).
- **AI Chat**: `chat_prompts` (scenario-based system prompts and greetings), `chat_conversations` (saved conversations).
- **Dealership API Keys**: `dealership_api_keys` (per-dealership API keys including OpenAI for custom AI training).
- **Schema Management**: Drizzle Kit for migrations, Zod schemas from Drizzle for runtime validation, type inference for full type safety.

### Development Workflow
- **Development**: Vite middleware for HMR, Replit-specific plugins.
- **Production**: Static file serving from `/dist/public`, server bundled with esbuild, environment-specific configuration.
- **Code Organization**: Monorepo with shared types in `/shared`, path aliases, strict TypeScript.

## Multi-Tenant Architecture

### Current State (Production-Ready for Single Dealership)
- **Hardcoded**: Default `dealershipId=1` for Olympic Hyundai Vancouver in tenant middleware
- **Security**: Dual-path resolution (JWT → subdomain → header → default), fail-closed for authenticated requests, `requireDealership` guards on 7 high-risk routes
- **Testing**: Comprehensive regression suite validating tenant isolation, invalid token handling, dealershipId tampering prevention

### Super Admin System (Multi-Tenant Management)
- **Role**: `super_admin` - System-wide administrator with no dealership affiliation (`dealershipId=null`)
- **Authentication**: JWT-based auth with enhanced security - auth middleware validates user status from database on every request to prevent stale tokens
- **Capabilities**:
  - Manage all dealerships (view, create, update)
  - Configure global API keys via `global_settings` table
  - Create new dealerships with full provisioning (dealership + master admin + financing rules + chat prompts)
  - View system-wide audit logs for compliance and security tracking
- **API Routes**: `/api/super-admin/*` endpoints protected with `superAdminOnly` middleware
- **Security Features**:
  - Auth middleware validates `isActive` status and refreshes role data from database
  - Audit logging tracks all administrative actions with IP address and user agent
  - Global settings support `isSecret` flag for sensitive configuration
  - Transactional dealership provisioning ensures atomicity
- **Seed Account**: `superadmin@olympicauto.com` (change password after first login)
- **Database Tables**:
  - `global_settings` - System-wide configuration storage
  - `audit_logs` - Security and compliance event tracking

### Expansion Path (Multi-Tenant SaaS)
- **Documented**: MULTI_TENANT_TODO.md outlines UI features (dealership selector), subdomain routing, background job improvements, deployment steps
- **Architecture**: Pool Model with shared tables, Row-Level Security ready, tenant resolution infrastructure in place
- **Super Admin Ready**: Full super admin system implemented for multi-dealership management

## External Dependencies

- **Database**: Neon Serverless PostgreSQL (`@neondatabase/serverless`).
- **Web Scraping**: Cheerio for parsing dealership websites (Olympic Hyundai, Boundary Hyundai, Kia Vancouver).
- **Build & Development**: Replit-specific Vite plugins, custom meta images plugin, Font Awesome CDN, Google Fonts (Inter).
- **Authentication**: JWT, bcrypt for password hashing.
- **Sales Manager Tools**:
    - **VIN Decoder**: NHTSA API.
    - **Market Pricing Analysis**:
        - **Primary**: MarketCheck API (enterprise-grade data).
        - **Secondary**: Apify AutoTrader.ca Actor (managed scraping).
        - **Fallback**: Puppeteer Scraper (direct AutoTrader.ca scraping).
        - **Geocoding**: Geocoder.ca API for Canadian postal codes.
- **Cron Scheduling**: Node-cron for scheduled tasks.
- **AI/LLM**: OpenAI GPT-5 via Replit AI Integrations (fallback) or per-dealership OpenAI API keys for custom training.

## Recent Changes (November 25, 2024)

### Vehicle Detail Enhancements (Latest)
- **Interactive Share & Like Buttons**: 
  - Share button uses Web Share API with clipboard fallback
  - Like button saves favorites to localStorage with visual feedback
  - Heart icon fills red when liked, shows toast notifications
- **Carfax Integration**: 
  - Added `carfaxUrl` field to vehicles schema
  - Displays Carfax link in vehicle details page with external link icon
  - Shows VIN and Stock Number in vehicle info grid
  - Template variable `{carfaxUrl}` available for Facebook post descriptions
  - **Automated Scraping**: Web scraper now automatically extracts Carfax URLs from dealership websites using 4 detection strategies:
    1. Direct link detection (`a[href*="carfax"]`)
    2. Data attribute extraction (`data-carfax`, `data-carfax-url`, `data-carfax-link`)
    3. Class-based detection (`.carfax-link`, `.carfax-button`, `.carfax-report`)
    4. Comprehensive URL scanning for carfax.com/carfax.ca domains
- **Facebook Multi-Image Posting**: 
  - Updated Facebook Marketplace posting to include ALL vehicle images
  - Previously only posted first image, now posts entire gallery
  - Supports Facebook's multi-image format (`images[0][url]`, `images[1][url]`, etc.)

### Enhanced Security Model - API Key Management
- **SuperAdmin Exclusive Control**: API Keys tab removed from Master Dashboard - only SuperAdmin can manage API keys
- **Comprehensive Onboarding**: SuperAdmin dealership creation wizard now captures ALL API keys during setup:
  - OpenAI API Key (custom AI training)
  - MarketCheck API Key (enterprise market pricing)
  - Apify API Token & Actor ID (AutoTrader.ca scraping)
  - Gemini API Key (future video generation)
  - GoHighLevel API Key & Location ID (CRM integration)
  - Facebook App ID & Secret (Marketplace posting)
- **Atomic Provisioning**: Backend creates dealership + master admin + financing rules + chat prompts + API keys in single transaction
- **Enhanced Security**: All API keys stored securely in `dealership_api_keys` table, masked in responses (****1234 format)

### Sales Manager Dashboard
- **Metrics Overview**: Added 4 KPI cards with real-time data:
  - Total Leads (all chat conversations)
  - Active Conversations (last 7 days)
  - Appointments Booked (placeholder - shows 0 with "Coming soon", requires future appointments system)
  - Scheduled Posts (Facebook posting queue count)
- **Read-Only Chat Prompts**: Added Chat Prompts section showing all 5 AI scenarios (test-drive, get-approved, value-trade, reserve, general) with greetings in accordion UI
- **Responsive Design**: 4-column responsive grid (2 cols on tablet, 4 on desktop) with loading states and comprehensive error handling

### AI Chat Prompt Management System
- **Database Prompts Control AI**: Chat prompts stored in `chat_prompts` table directly control OpenAI AI behavior
- **Scenario-Based Prompts**: 5 scenarios supported (test-drive, get-approved, value-trade, reserve, general)
- **Per-Dealership Configuration**: Each dealership can customize prompts via Master Dashboard
- **Master Dashboard UI**: Chat Prompts tab for managing all 5 scenarios with system prompts and greetings
- **Full Integration**: ChatBot component passes scenario/dealershipId across all code paths (manual input, CTA auto-send, ChatContext)
- **Security**: Strict multi-tenant filtering on all prompt operations
- **Credit Tier Fix**: Interest rate validation updated to support basis points (max 10000 instead of 100)