# Olympic Auto Group - Digital Flagship Inventory System

## Overview
This project is a full-stack vehicle inventory management system for Olympic Auto Group dealerships. It allows customers to browse inventory, view detailed vehicle information, and calculate financing options across multiple locations. Key features include automated inventory synchronization via web scraping, view tracking for remarketing purposes, and a customer engagement chatbot. The system is designed for production use in single dealerships and incorporates a multi-tenant architecture for future expansion. The business vision is to provide a comprehensive digital platform that streamlines vehicle sales and customer interaction for the automotive group, enhancing market presence and operational efficiency.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Frameworks**: React 18 with TypeScript, Vite, Wouter for routing, TanStack Query for server state management.
- **UI/UX**: Shadcn UI (New York style) with Radix UI, Tailwind CSS v4, custom CSS variables for branding (#022d60 dark, #00aad2 light), Lucide React for iconography.
- **Design Decisions**: Component-based architecture, custom filtering for inventory, real-time financing calculator, session-based view tracking.
- **Dark Mode**: Custom ThemeProvider (`client/src/components/ThemeProvider.tsx`) with localStorage persistence, system preference detection, and ThemeToggle component. All pages use theme-aware CSS tokens (bg-background, text-foreground, border-border, etc.).
- **Mobile Responsive**: All dashboards use responsive layouts with flex-col/flex-row stacking, w-full buttons on mobile, overflow-x-auto for tables, and responsive tab grids (grid-cols-2 sm:grid-cols-4).

### Backend Architecture
- **Server**: Express.js with TypeScript, custom request logging middleware.
- **API Design**: RESTful API (`/api`) for vehicle CRUD, authentication, user management, financing rules, Facebook posting, remarketing, and PBS DMS integration. Supports backward-compatible pagination.
- **Multi-Tenancy**: Pool Model architecture with shared tables, `dealership_id` filtering at the storage layer. Dual-path tenant resolution (JWT → subdomain → header → default=1) with fail-closed security. `requireDealership` guards on high-risk routes.
- **Security**: JWT authentication with httpOnly cookies, Role-Based Access Control (RBAC), multi-tenant data isolation, Zod schema validation, PATCH payload sanitization, defense-in-depth.
- **Data Access**: Storage abstraction with `IStorage` interface, Drizzle ORM for type-safe queries, PostgreSQL (Neon serverless). All queries filtered by `dealership_id`.
- **Scheduled Jobs**: Cron-based inventory synchronization (daily at 2:00 AM) and manual sync capabilities, leveraging web scraping with Cheerio and Puppeteer.

### Database Schema
- **Core Tables**: `vehicles`, `vehicle_views`, `filter_groups` (dealership-scoped inventory categories).
- **User Management**: `users`.
- **Financing Rules**: `credit_score_tiers`, `model_year_terms`.
- **Facebook Posting**: `facebook_accounts`, `ad_templates`, `posting_queue`, `posting_schedule`.
- **Facebook Catalog**: `facebook_catalog_config` (stores Catalog ID, System User Access Token, sync status per dealership).
- **Remarketing**: `remarketing_vehicles`.
- **PBS DMS Integration**: `pbs_config`, `pbs_webhook_events`, `pbs_sessions`, `pbs_contact_cache`, `pbs_appointment_cache`, `pbs_parts_cache`, `pbs_api_logs`.
- **GoHighLevel CRM Integration**: `ghl_accounts` (OAuth tokens per dealership), `ghl_config` (sync settings), `ghl_webhook_events`, `ghl_contact_sync` (track synced contacts between GHL/PBS/Lotview), `ghl_appointment_sync` (track synced appointments), `ghl_api_logs`.
- **AI Chat**: `chat_prompts`, `chat_conversations`.
- **Dealership API Keys**: `dealership_api_keys`.
- **Super Admin**: `global_settings`, `audit_logs`.
- **Schema Management**: Drizzle Kit for migrations, Zod schemas from Drizzle for runtime validation and type inference.

### Development Workflow
- **Development**: Vite middleware for HMR, Replit-specific plugins.
- **Production**: Static file serving from `/dist/public`, server bundled with esbuild, environment-specific configuration.
- **Code Organization**: Monorepo with shared types in `/shared`, path aliases, strict TypeScript.

### Role Hierarchy & Access Control
The system uses Role-Based Access Control (RBAC) with the following roles (highest to lowest):
- **`super_admin`**: System-wide administrator with no dealership affiliation (`dealershipId=null`). Manages all dealerships, global API keys, system settings, and audit logs. Has "Login As" impersonation capability.
- **`master`**: **General Manager** - Top authority at the dealership level. Full access to all dealership features including Call Analysis, user management, and all sales/service tools.
- **`admin`**: Administrator - High-level dealership access for configuration and management tasks.
- **`manager`**: Sales Manager - Access to team performance, Call Analysis dashboard, inventory management, and sales tools.
- **`salesperson`**: Sales staff - Access to customer-facing features, lead management, and personal performance metrics.

**Authorization Patterns:**
- Use `requireRole('manager', 'admin', 'master', 'super_admin')` for management features
- Use `superAdminOnly` middleware for system-wide administration
- Use `requireDealership` guards on high-risk routes for tenant isolation

### Multi-Tenant Management
- **Current State**: Production-ready for single dealerships with hardcoded default `dealershipId=1`. Security measures include dual-path resolution and `requireDealership` guards.
- **Super Admin System**: Implemented `super_admin` role for system-wide administration with no dealership affiliation (`dealershipId=null`). This role manages dealerships, global API keys, and system-wide audit logs. Authentication involves JWT with enhanced security for active status validation.
- **Impersonation Feature**: Super Admins can "Login As" any user for support/debugging with full audit trail in `impersonation_sessions` table.
- **Expansion Path**: Designed for future multi-tenant SaaS, using a Pool Model with shared tables and Row-Level Security readiness. The Super Admin system is fully prepared for multi-dealership management.

## External Dependencies

- **Database**: Neon Serverless PostgreSQL (`@neondatabase/serverless`).
- **Web Scraping**: Puppeteer for CarGurus listings, Apify AutoTrader.ca Actor, direct Puppeteer scraping for AutoTrader.ca.
- **Build & Development**: Replit-specific Vite plugins, Font Awesome CDN, Google Fonts (Inter).
- **Authentication**: JWT, bcrypt for password hashing.
- **Sales Manager Tools**:
    - **VIN Decoder**: NHTSA API.
    - **Market Pricing Analysis**: MarketCheck API, Apify AutoTrader.ca Actor.
    - **Geocoding**: Geocoder.ca API.
- **Cron Scheduling**: Node-cron for inventory sync (midnight), Facebook token refresh (3 AM), market analysis (3 AM), Facebook Catalog sync (4 AM), GHL CRM sync (5 AM).
- **AI/LLM**: OpenAI GPT-5 via Replit AI Integrations (fallback) or per-dealership OpenAI API keys.
- **Carfax Integration**: Automated scraping of Carfax URLs from dealership websites.
- **Facebook Integration**: OAuth 2.0 flow for page connections, page posting APIs, vehicle posting automation. Routes in `server/routes.ts` for `/api/facebook/auth`, `/api/facebook/callback`, page management endpoints.
- **Facebook Catalog API**: Super Admin-managed Catalog ID and System User Access Token per dealership for paid automotive inventory ads. Service in `server/facebook-catalog-service.ts` formats vehicles for Facebook's automotive feed format. Daily auto-sync at 4 AM for catalogs with auto-sync enabled. UI management in Super Admin dashboard under "FB Catalogs" tab.
- **PBS Partner Hub API**: Full integration with PBS DMS for AI-powered automotive operations. Service in `server/pbs-api-service.ts` provides:
    - **Session Management**: Automatic login, session reuse, and 401 auto-refresh with encrypted credentials.
    - **Sales Module**: ContactGet/Save/Change, ContactVehicleGet, WorkplanEventGet/Change, WorkplanAppointmentGet/Change/Create, WorkplanReminderGet.
    - **Service Module**: AppointmentBookingGet, AppointmentGet/Change/Create, RepairOrderGet/Change, AppointmentContactVehicleGet/Change.
    - **Parts Module (Read-Only)**: PartsInventoryGet/Search, PartsOrderGet, PurchaseOrderGet, TireStorageGet, ShopGet.
    - **Caching Layer**: Contact, appointment, and parts caching with configurable TTL to reduce DMS load.
    - **API Logging**: All PBS API calls logged to `pbs_api_logs` for debugging and monitoring.
    - **Retry Logic**: Exponential backoff for rate limits (429), network errors, and session expiration (401).
    - **Multi-Tenant Isolation**: All operations scoped to dealershipId from JWT or tenant middleware.
- **GoHighLevel CRM Integration**: Full OAuth 2.0 integration for CRM synchronization. Services in `server/ghl-api-service.ts`, `server/ghl-sync-service.ts`, `server/ghl-pbs-bridge.ts` provide:
    - **OAuth 2.0 Flow**: Each dealership connects their own GHL sub-account via OAuth. Token refresh with 5-minute buffer.
    - **Contacts API**: Create, update, search contacts. Bidirectional sync with PBS DMS contacts.
    - **Calendars API**: List calendars, create/update/delete calendar events. Map sales/service calendars for appointment sync.
    - **Opportunities API**: Create/update opportunities in pipelines. Auto-create opportunities for vehicle interests.
    - **Webhooks**: Signature-verified webhook receiver at `/api/ghl/webhook`. Multi-tenant routing via locationId with active account validation.
    - **Outbound Sync**: Push Lotview leads and PBS contacts/appointments to GHL. Queue-based pending sync processing.
    - **PBS Bridge**: Bidirectional sync between GHL and PBS DMS. Contact and appointment mapping with sync status tracking.
    - **Dashboard UI**: GhlIntegrationDialog in Super Admin for OAuth connection, sync settings, calendar/pipeline mappings.
    - **Scheduled Sync**: Daily batch reconciliation at 5 AM for all dealerships with bidirectional sync enabled.

## Legal Compliance Pages

### Privacy Policy (`/privacy-policy`)
Comprehensive privacy policy required for Facebook app approval and general compliance:
- **Data Collection**: Personal information, vehicle inventory data, automatically collected data
- **Lawful Bases (GDPR)**: Consent, contractual necessity, legitimate interests, legal obligation
- **Meta/Facebook Integration**: Catalog API disclosure, Pixel tracking, consent handling
- **International Transfers**: Standard Contractual Clauses, encryption, Data Privacy Framework
- **Data Retention**: Specific retention periods by data type
- **User Rights**: GDPR (EU), CCPA (California), PIPEDA (Canada) rights articulated
- **Data Security**: Technical and organizational measures, breach notification
- **Cookie Policy**: Categories (essential, analytics, advertising, preference) with consent requirements

### Terms of Service (`/terms-of-service`)
SaaS terms for dealership partners and general users:
- **Subscription Terms**: Plan types, billing, renewal, termination
- **Service Level Agreement**: 99.5% uptime target, service credits, support response times
- **Fees & Payment**: CAD pricing, late payment interest, suspension policy
- **Data Ownership**: Dealerships retain ownership, license grant for display/syndication
- **Liability Caps**: 12-month fee cap, consequential damages exclusion
- **Dispute Resolution**: BC Canada governing law, informal resolution, mediation, jurisdiction
- **Acceptable Use**: Prohibited activities for dealership partners

### Footer Integration
Both legal pages linked from the main Inventory page footer with copyright notice.