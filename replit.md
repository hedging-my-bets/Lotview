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
- **Cron Scheduling**: Node-cron (inventory sync, Facebook token refresh, market analysis, Facebook Catalog sync, GHL CRM sync).
- **AI/LLM**: OpenAI GPT-5 via Replit AI Integrations or per-dealership OpenAI API keys.
- **Carfax Integration**: Automated scraping of Carfax URLs.
- **Facebook Integration**: OAuth 2.0, Graph API for page connections, page posting, and Facebook Catalog API.
- **PBS Partner Hub API**: Integration with PBS DMS for session management, sales, service, and parts modules, caching, logging, and retry logic.
- **GoHighLevel CRM Integration**: OAuth 2.0 integration for contacts, calendars, opportunities, and conversations APIs. Includes webhook handling, bidirectional sync with PBS DMS, and scheduled batch reconciliation.
- **Facebook Messenger Conversations**: Integration for split-view inbox, role-based access, and GHL sync.
- **Call Scoring & Coaching System**: Department-specific scoring templates with weighted criteria, AI draft scores, speaker recognition, and speaking time analysis.