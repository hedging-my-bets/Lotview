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
- Facebook page management for social media integration
- Manual sync trigger endpoint for on-demand inventory updates

**Data Access Layer:**
- Storage abstraction pattern with `IStorage` interface for database operations
- Drizzle ORM for type-safe database queries
- PostgreSQL as the primary database (via Neon serverless)

**Scheduled Jobs:**
- Cron-based inventory synchronization running daily at 2:00 AM
- Manual sync capability for immediate updates
- Web scraping service using Cheerio for extracting vehicle data from dealer websites

### Database Schema

**Tables:**
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

3. **facebook_pages** - Social media integration
   - Page credentials and configuration
   - Active status and template selection
   - Connection timestamps

4. **page_priority_vehicles** - Featured vehicle management
   - Many-to-many relationship between pages and vehicles
   - Priority ordering for social media posts

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

**Session & State Management:**
- Client-side session ID generation for anonymous user tracking
- No authentication system currently implemented (noted as "coming soon" for sales team login)

**Cron Scheduling:**
- Node-cron for scheduled inventory synchronization tasks
- Configurable sync intervals (default: daily at 2:00 AM)