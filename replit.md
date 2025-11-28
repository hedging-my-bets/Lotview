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
- **Core Tables**: `vehicles`, `vehicle_views`.
- **User Management**: `users`.
- **Financing Rules**: `credit_score_tiers`, `model_year_terms`.
- **Facebook Posting**: `facebook_accounts`, `ad_templates`, `posting_queue`, `posting_schedule`.
- **Remarketing**: `remarketing_vehicles`.
- **PBS DMS Integration**: `pbs_config`, `pbs_webhook_events`.
- **AI Chat**: `chat_prompts`, `chat_conversations`.
- **Dealership API Keys**: `dealership_api_keys`.
- **Super Admin**: `global_settings`, `audit_logs`.
- **Schema Management**: Drizzle Kit for migrations, Zod schemas from Drizzle for runtime validation and type inference.

### Development Workflow
- **Development**: Vite middleware for HMR, Replit-specific plugins.
- **Production**: Static file serving from `/dist/public`, server bundled with esbuild, environment-specific configuration.
- **Code Organization**: Monorepo with shared types in `/shared`, path aliases, strict TypeScript.

### Multi-Tenant Management
- **Current State**: Production-ready for single dealerships with hardcoded default `dealershipId=1`. Security measures include dual-path resolution and `requireDealership` guards.
- **Super Admin System**: Implemented `super_admin` role for system-wide administration with no dealership affiliation (`dealershipId=null`). This role manages dealerships, global API keys, and system-wide audit logs. Authentication involves JWT with enhanced security for active status validation.
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
- **Cron Scheduling**: Node-cron.
- **AI/LLM**: OpenAI GPT-5 via Replit AI Integrations (fallback) or per-dealership OpenAI API keys.
- **Carfax Integration**: Automated scraping of Carfax URLs from dealership websites.
- **Facebook Integration**: OAuth 2.0 flow for page connections, page posting APIs, vehicle posting automation. Routes in `server/routes.ts` for `/api/facebook/auth`, `/api/facebook/callback`, page management endpoints.