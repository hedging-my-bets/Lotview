# Olympic Auto Group - Digital Flagship Inventory System

## Overview
This project is a full-stack vehicle inventory management system for Olympic Auto Group dealerships. It enables customers to browse inventory, view detailed vehicle information, and calculate financing options across multiple locations. Key capabilities include automated inventory synchronization, view tracking for remarketing, and a customer engagement chatbot. The system supports single dealerships with a multi-tenant architecture for future expansion. The business vision is to streamline vehicle sales and customer interaction, enhancing market presence and operational efficiency.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Frameworks**: React 18 with TypeScript, Vite, Wouter, TanStack Query.
- **UI/UX**: Shadcn UI (New York style) with Radix UI, Tailwind CSS v4, custom CSS variables for branding, Lucide React for iconography.
- **Design Decisions**: Component-based architecture, custom filtering, real-time financing calculator, session-based view tracking.
- **Theming**: Custom ThemeProvider with localStorage persistence, system preference detection, and ThemeToggle for dark mode.
- **Responsiveness**: Mobile-responsive layouts across all dashboards.

### Backend Architecture
- **Server**: Express.js with TypeScript.
- **API Design**: RESTful API for vehicle CRUD, authentication, user management, financing rules, Facebook posting, remarketing, and PBS DMS integration. Supports backward-compatible pagination.
- **Multi-Tenancy**: Pool Model with shared tables, `dealership_id` filtering, and dual-path tenant resolution. `requireDealership` guards on high-risk routes.
- **Security**: JWT authentication (httpOnly cookies), Role-Based Access Control (RBAC), multi-tenant data isolation, Zod schema validation, PATCH payload sanitization.
- **Data Access**: `IStorage` interface, Drizzle ORM, PostgreSQL (Neon serverless). All queries filtered by `dealership_id`.
- **Scheduled Jobs**: Cron-based inventory synchronization and manual sync.

### Database Schema
- **Core Tables**: `vehicles`, `vehicle_views`, `filter_groups`.
- **User Management**: `users`.
- **Financing Rules**: `credit_score_tiers`, `model_year_terms`.
- **Integrations**: `facebook_accounts`, `ad_templates`, `posting_queue`, `posting_schedule`, `facebook_catalog_config`, `remarketing_vehicles`, `pbs_config`, `pbs_webhook_events`, `pbs_sessions`, `pbs_contact_cache`, `pbs_appointment_cache`, `pbs_parts_cache`, `pbs_api_logs`, `ghl_accounts`, `ghl_config`, `ghl_webhook_events`, `ghl_contact_sync`, `ghl_appointment_sync`, `ghl_api_logs`.
- **AI/Chat**: `chat_prompts`, `chat_conversations`.
- **Call Scoring**: `call_scoring_templates`, `call_scoring_criteria`, `call_scoring_sheets`, `call_scoring_responses`, `call_participants`.
- **Admin**: `dealership_api_keys`, `global_settings`, `audit_logs`.
- **Schema Management**: Drizzle Kit for migrations, Zod schemas for validation.

### Development Workflow
- **Development**: Vite middleware for HMR.
- **Production**: Static file serving, server bundled with esbuild, environment-specific configuration.
- **Code Organization**: Monorepo with shared types, path aliases, strict TypeScript.

### Role Hierarchy & Access Control
- **Roles**: `super_admin`, `master`, `admin`, `manager`, `salesperson`.
- **Authorization Patterns**: Middleware like `requireRole` and `superAdminOnly` for access control and `requireDealership` for tenant isolation.

### Multi-Tenant Management
- **Current State**: Production-ready for single dealerships with default `dealershipId=1`.
- **Super Admin System**: `super_admin` role for system-wide administration, managing dealerships and global settings. Includes "Login As" impersonation.
- **Expansion Path**: Designed for future multi-tenant SaaS using a Pool Model.

### Legal Compliance Pages
- **Privacy Policy**: Covers data collection, lawful bases, Meta/Facebook integration, international transfers, data retention, user rights, data security, and cookie policy.
- **Terms of Service**: Addresses subscription terms, SLA, fees, data ownership, liability caps, and dispute resolution.
- Both pages are linked from the main Inventory page footer.

## External Dependencies

- **Database**: Neon Serverless PostgreSQL.
- **Web Scraping**: Puppeteer (CarGurus, AutoTrader.ca), Apify AutoTrader.ca Actor.
- **Build & Development**: Replit-specific Vite plugins, Font Awesome CDN, Google Fonts (Inter).
- **Authentication**: JWT, bcrypt.
- **Sales Manager Tools**: NHTSA API (VIN Decoder), MarketCheck API (Market Pricing), Geocoder.ca API (Geocoding).
- **Cron Scheduling**: Node-cron (inventory sync, Facebook token refresh, market analysis, Facebook Catalog sync, FWC CRM sync).
- **Robust Scraper**: Three-tier system with Browserless.io as PRIMARY:
  1. **Primary**: Browserless.io cloud Puppeteer (~$50/month for 10,000 sessions)
     - Unified service: `browserless-unified.ts` handles all scraping
     - Full VDP scraping for complete vehicle details (VIN, images, specs, colors)
     - CarGurus and AutoTrader.ca market analysis
     - Automatic retry with exponential backoff (3s, 8s, 15s)
  2. **Secondary**: Local Puppeteer (FREE fallback when Browserless unavailable)
  3. **Tertiary**: Cache preserve mode (keeps existing inventory to prevent data loss)
  - **API Routes** (super admin):
    - `GET /api/super-admin/browserless/test` - Test connection
    - `POST /api/super-admin/browserless/scrape-inventory` - Trigger inventory scrape
    - `POST /api/super-admin/browserless/scrape-market` - Market analysis scrape
    - `GET /api/super-admin/browserless/status` - View scrape history
  - **API Key**: `BROWSERLESS_API_KEY` environment secret (or per-dealership in `dealership_api_keys.browserlessApiKey`)
  - Scrape runs logged in `scrape_runs` table with status, method, duration, and error details
  - **Methods tracked**: `browserless`, `local_puppeteer`, `cache_preserve`
  - **Checkpoint System** (Dec 2025): Resume-capable scraping with crash recovery
    - `scrape_queue` table tracks VDP URLs with status (pending/processing/completed/failed)
    - Extracts all VDP URLs from listing page first, saves to queue
    - Processes vehicles in batches of 5, checkpointing each completed vehicle
    - On restart, resumes from incomplete queue entries (no data loss on browser crashes)
    - Storage methods: `createScrapeQueueBatch()`, `updateScrapeQueueStatus()`, `getIncompleteScrapeQueue()`
- **AI/LLM**: OpenAI GPT-5 via Replit AI Integrations or per-dealership OpenAI API keys.
- **Carfax Integration**: Automated scraping of Carfax URLs.
- **Facebook Integration**: OAuth 2.0, Graph API for page connections, page posting, and Facebook Catalog API.
- **PBS Partner Hub API**: Integration with PBS DMS for session management, sales, service, and parts modules, caching, logging, and retry logic.
- **FWC CRM Integration**: Framework Consulting Software integration for contacts, calendars, opportunities, and conversations APIs. Includes webhook handling, bidirectional sync with PBS DMS, and scheduled batch reconciliation.
- **Facebook Messenger Conversations**: Integration for split-view inbox, role-based access, and FWC sync.
- **Real-Time WebSocket Notifications**: Server broadcasts `new_message` and `conversation_update` events to connected clients via `/ws` endpoint with JWT authentication. ConversationsPanel auto-updates instantly when new messages arrive from GHL webhooks.
- **Call Scoring & Coaching System**: Department-specific scoring templates (Sales, Service, Parts, General Inquiry) with weighted criteria, AI draft scores, speaker recognition, and speaking time analysis.

### FWC Call Recording Integration

**Webhook Endpoint**: `POST /api/ghl/webhook` or `POST /api/ghl/call-webhook`

**FWC Workflow Setup**:
1. Create a workflow triggered by "Call Completed" event
2. Add a 60-second delay (to allow FWC transcription to complete)
3. Add a webhook action with the following configuration:
   - URL: `https://your-domain.com/api/ghl/webhook`
   - Method: POST
   - Content-Type: application/json
   - Body (JSON):
   ```json
   {
     "type": "CallCompleted",
     "contactId": "{{contact.id}}",
     "contactName": "{{contact.full_name}}",
     "contactPhone": "{{contact.phone}}",
     "contactEmail": "{{contact.email}}",
     "callRecordingUrl": "{{call.recording_url}}",
     "transcription": "{{call.transcription}}",
     "duration": "{{call.duration}}",
     "direction": "{{call.direction}}",
     "callStatus": "{{call.status}}",
     "timestamp": "{{current_time}}"
   }
   ```

**Automatic Processing Flow**:
1. Webhook receives call data with FWC-provided transcription
2. Call recording is stored in `call_recordings` table
3. AI analysis runs automatically using OpenAI GPT-4o
4. Department is auto-detected from transcription keywords (sales, service, parts, general)
5. Appropriate scoring template is selected based on detected department
6. AI-generated draft scores are created for each criterion
7. Manager can review and finalize scores in the Call Scoring UI

**Cost Savings**: Uses FWC's built-in transcription ($0.03/min) instead of in-app transcription.