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
- **Financing Rules**: `credit_score_tiers` (interest rates), `model_year_terms` (financing term eligibility).
- **Facebook Posting**: `facebook_accounts`, `ad_templates`, `posting_queue`, `posting_schedule`.
- **Remarketing**: `remarketing_vehicles` (selected vehicles for campaigns).
- **PBS DMS Integration**: `pbs_config` (API configuration), `pbs_webhook_events` (event log).
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

### Expansion Path (Multi-Tenant SaaS)
- **Documented**: MULTI_TENANT_TODO.md outlines UI features (dealership selector), subdomain routing, background job improvements, deployment steps
- **Architecture**: Pool Model with shared tables, Row-Level Security ready, tenant resolution infrastructure in place

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