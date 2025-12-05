# LotView.ai - Complete Setup & Configuration Guide

A comprehensive step-by-step guide to configure and deploy LotView.ai for your dealership(s). This covers **everything**: API keys, onboarding, SEO, scraping, subdomains, Facebook Catalog, Marketplace posting, ChatGPT, PBS DMS, GoHighLevel CRM, Call Analysis, and more.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Initial Database Setup](#2-initial-database-setup)
3. [Environment Variables & Secrets](#3-environment-variables--secrets)
4. [Super Admin Setup](#4-super-admin-setup)
5. [Dealership Onboarding](#5-dealership-onboarding)
6. [User Management & Roles](#6-user-management--roles)
7. [OpenAI / ChatGPT Integration](#7-openai--chatgpt-integration)
8. [AI Chat Configuration](#8-ai-chat-configuration)
9. [Facebook Integration](#9-facebook-integration)
   - [Facebook App Setup](#91-facebook-app-setup)
   - [Facebook OAuth Flow](#92-facebook-oauth-flow)
   - [Facebook Catalog API](#93-facebook-catalog-api-for-automotive-ads)
   - [Facebook Marketplace Posting](#94-facebook-marketplace-posting)
   - [Facebook Token Management](#95-facebook-token-management)
10. [PBS DMS Integration](#10-pbs-dms-integration)
11. [GoHighLevel CRM Integration](#11-gohighlevel-crm-integration)
12. [Call Analysis Setup](#12-call-analysis-setup)
13. [Inventory Scraping](#13-inventory-scraping)
    - [AutoTrader.ca Scraping](#131-autotraderca-scraping)
    - [CarGurus Scraping](#132-cargurus-scraping)
    - [Apify Integration](#133-apify-integration)
    - [Custom Dealer Website Scraping](#134-custom-dealer-website-scraping)
14. [Market Pricing & Analysis](#14-market-pricing--analysis)
15. [Subdomain Configuration](#15-subdomain-configuration)
16. [SEO Configuration](#16-seo-configuration)
17. [Google Analytics & Remarketing](#17-google-analytics--remarketing)
18. [Object Storage Setup](#18-object-storage-setup)
19. [Scheduled Jobs & Cron Tasks](#19-scheduled-jobs--cron-tasks)
20. [Publishing & Deployment](#20-publishing--deployment)
21. [Updating Without Losing Data](#21-updating-without-losing-data)
22. [Troubleshooting](#22-troubleshooting)
23. [Quick Reference: All Secrets](#23-quick-reference-all-secrets)

---

## 1. Prerequisites

Before starting, ensure you have:

- [ ] A Replit account with the project forked/cloned
- [ ] Access to your dealership's inventory data source (website, DMS, or manual)
- [ ] A Facebook Business Account (for Facebook integrations)
- [ ] An OpenAI account (for AI features) - *Optional: Replit provides one*
- [ ] PBS Partner Hub credentials (if using PBS DMS)
- [ ] GoHighLevel account (for CRM/Call Analysis)
- [ ] Domain name (for custom subdomains) - *Optional*

---

## 2. Initial Database Setup

LotView.ai uses PostgreSQL (Neon Serverless) for data persistence. **All data persists across deployments.**

### Step 1: Database is Auto-Provisioned
Replit automatically creates a PostgreSQL database. Verify it exists by checking:
- The `DATABASE_URL` secret in Replit Secrets panel
- Database pane in Replit workspace

### Step 2: Run Database Migrations
Migrations run automatically on startup via Drizzle ORM. To manually push schema changes:

```bash
npm run db:push
```

### Step 3: Key Database Tables

| Table | Purpose |
|-------|---------|
| `dealerships` | Multi-tenant dealership records |
| `users` | User accounts with roles |
| `vehicles` | Vehicle inventory |
| `vehicle_views` | View tracking for remarketing |
| `chat_conversations` | AI chat history |
| `chat_prompts` | AI prompt configurations |
| `facebook_accounts` | Connected Facebook pages |
| `facebook_catalog_config` | Facebook Catalog API settings |
| `pbs_config` | PBS DMS configuration |
| `pbs_sessions` | PBS API session cache |
| `ghl_accounts` | GoHighLevel OAuth tokens |
| `ghl_config` | GHL sync settings |
| `call_recordings` | Call analysis data |
| `call_analysis_criteria` | AI scoring criteria |
| `impersonation_sessions` | Super Admin login-as audit trail |
| `audit_logs` | System audit trail |

---

## 3. Environment Variables & Secrets

### Where to Set Secrets
1. Open your Replit project
2. Click **"Secrets"** in the Tools panel (or press Ctrl+Shift+S)
3. Add each secret as a key-value pair

### Required Secrets

| Secret Name | Description | How to Get |
|-------------|-------------|------------|
| `DATABASE_URL` | PostgreSQL connection | Auto-provided by Replit |
| `JWT_SECRET` | JWT signing key | Generate: `openssl rand -hex 32` |
| `SESSION_SECRET` | Express session secret | Generate: `openssl rand -hex 32` |

### Facebook Secrets

| Secret Name | Description | Where to Get |
|-------------|-------------|--------------|
| `FACEBOOK_APP_ID` | Facebook App ID | [developers.facebook.com](https://developers.facebook.com) |
| `FACEBOOK_APP_SECRET` | Facebook App Secret | Facebook Developer Console |

### OpenAI Secrets

| Secret Name | Description |
|-------------|-------------|
| `AI_INTEGRATIONS_OPENAI_API_KEY` | Auto-populated by Replit |
| `AI_INTEGRATIONS_OPENAI_BASE_URL` | Auto-populated by Replit |

**Note**: Replit automatically provides OpenAI access. You only need to configure per-dealership keys if you want separate billing.

### GoHighLevel Secrets

| Secret Name | Description | Where to Get |
|-------------|-------------|--------------|
| `GHL_CLIENT_ID` | GHL OAuth Client ID | GHL Developer Marketplace |
| `GHL_CLIENT_SECRET` | GHL OAuth Client Secret | GHL Developer Marketplace |
| `GHL_REDIRECT_URI` | OAuth callback URL | `https://your-domain/api/ghl/auth/callback` |

### Optional API Keys

| Secret Name | Description | Where to Get |
|-------------|-------------|--------------|
| `MARKETCHECK_API_KEY` | Market pricing data | [marketcheck.com](https://www.marketcheck.com) |
| `APIFY_API_TOKEN` | AutoTrader.ca scraping | [apify.com](https://apify.com) |
| `APIFY_AUTOTRADER_ACTOR_ID` | Apify Actor ID | Apify Console |
| `GEOCODER_CA_USERNAME` | Canadian geocoding | [geocoder.ca](https://geocoder.ca) |
| `GEOCODER_CA_PASSWORD` | Geocoder.ca password | Geocoder.ca Account |
| `SCRAPER_PROXIES` | Proxy list for scraping | Your proxy provider |

### Environment Variables (Non-Sensitive)

Set in Replit's Environment Variables section:

```
SCHEDULER_ENABLED=true
FACEBOOK_REDIRECT_URI=https://your-domain.replit.app/api/facebook/oauth/callback
```

---

## 4. Super Admin Setup

The Super Admin is the system-wide administrator who manages all dealerships.

### Step 1: Create Super Admin (Recommended Method)

The easiest way to create a Super Admin:

1. **Register a regular user first** through the app's registration endpoint or UI
2. **Update their role in the database** using Replit's Database pane:

```sql
-- Promote an existing user to Super Admin
UPDATE users 
SET role = 'super_admin', dealership_id = NULL 
WHERE email = 'your@email.com';
```

### Alternative: Create via SQL (Advanced)

If you need to create everything from scratch via SQL:

```sql
-- Step 1: Create a dealership (required - slug is mandatory and must be unique)
INSERT INTO dealerships (name, slug, subdomain, address, city, province, phone)
VALUES (
  'Olympic Auto Group',
  'olympic-auto',           -- URL-safe identifier (required, unique)
  'olympic',                -- Subdomain for routing (optional)
  '123 Main St',
  'Vancouver',
  'BC',
  '604-555-0100'
);

-- Step 2: Create Super Admin user
-- NOTE: password_hash must be a valid bcrypt hash - generate one using the app first
INSERT INTO users (email, password_hash, name, role, dealership_id, is_active)
VALUES (
  'superadmin@lotview.ai',
  '$2b$10$YOUR_BCRYPT_HASH_HERE',  -- Use a real bcrypt hash!
  'Super Admin',                    -- Display name (not username)
  'super_admin',
  NULL,                             -- Super Admin has NO dealership affiliation
  true
);
```

**Important**: Never use a plaintext password in SQL. Always use bcrypt hashing. The recommended method above avoids this issue entirely.

### Step 2: Access Super Admin Dashboard

1. Login at `/login` with your Super Admin credentials
2. Navigate to **Super Admin Dashboard** (`/super-admin`)

### Step 3: Super Admin Capabilities

| Feature | Description |
|---------|-------------|
| **Dealership Management** | Create, edit, delete dealerships |
| **User Management** | View all users, reset passwords |
| **API Keys Configuration** | Set global and per-dealership API keys |
| **Facebook Catalog Config** | Manage Catalog IDs and System User tokens |
| **GHL Integration** | Configure GoHighLevel connections |
| **Audit Logs** | View all system changes |
| **Login As (Impersonation)** | Access any user's account for support |

---

## 5. Dealership Onboarding

### Step 1: Create a New Dealership

1. Login as Super Admin
2. Go to **Super Admin Dashboard** → **Dealerships** tab
3. Click **"Add Dealership"**
4. Fill in:

| Field | Example | Required |
|-------|---------|----------|
| Name | Olympic Hyundai Vancouver | Yes |
| Slug | `olympic-hyundai` (URL-safe identifier) | Yes |
| Subdomain | `olympic-hyundai` → becomes `olympic-hyundai.lotview.ai` | Optional |
| Address | 789 Auto Row | Optional |
| City | Vancouver | Optional |
| Province | BC | Optional |
| Phone | (604) 555-0123 | Optional |

### Step 2: Configure Dealership API Keys

Each dealership can have their own API keys (overrides global):

1. Go to **Super Admin Dashboard** → **Dealerships** → Click dealership
2. Click **"Configure Integrations"** (plug icon)
3. Enter API keys:
   - OpenAI API Key
   - MarketCheck API Key
   - Apify Token & Actor ID
   - Facebook App ID & Secret (if separate app)
   - GHL credentials (if separate account)

### Step 3: Create Master User (General Manager)

1. Go to **Super Admin Dashboard** → **Users** tab
2. Click **"Add User"**
3. Fill in:
   - Email, Username, Password
   - Role: **Master** (General Manager)
   - Dealership: Select the new dealership
4. This user has full access to their dealership

---

## 6. User Management & Roles

### Role Hierarchy (Highest to Lowest)

| Role | Title | Permissions |
|------|-------|-------------|
| `super_admin` | System Administrator | All system access, manages all dealerships, no dealership affiliation |
| `master` | **General Manager** | Full dealership access, user management, Call Analysis, all tools |
| `admin` | Administrator | High-level dealership configuration, most management features |
| `manager` | Sales Manager | Team performance, Call Analysis, inventory, sales tools |
| `salesperson` | Sales Staff | Customer-facing features, lead management, personal metrics |

### Creating Users

1. Login as Master, Admin, or Super Admin
2. Go to **Dashboard** → **User Management**
3. Click **"Add User"**
4. Assign appropriate role

### Impersonation (Super Admin Only)

For support and debugging:

1. Go to **Super Admin Dashboard** → **Users** tab
2. Click **"Login As"** next to any user
3. A persistent banner shows impersonation is active
4. Click **"Exit Impersonation"** to return
5. All impersonation sessions are logged in `impersonation_sessions` table

---

## 7. OpenAI / ChatGPT Integration

LotView.ai uses OpenAI GPT for:
- Customer-facing AI chatbot
- Call analysis and scoring
- Vehicle description generation
- Market analysis summaries

### Option A: Use Replit's Built-in OpenAI (Recommended)

Replit automatically provides OpenAI access with these auto-configured secrets:
- `AI_INTEGRATIONS_OPENAI_API_KEY`
- `AI_INTEGRATIONS_OPENAI_BASE_URL`

**No setup required!** The system automatically uses these.

### Option B: Per-Dealership OpenAI Keys

For separate billing per dealership:

1. Get API key from [platform.openai.com](https://platform.openai.com)
2. Go to **Super Admin Dashboard** → **Dealerships** → **[Dealership]** → **API Keys**
3. Enter the OpenAI API Key
4. Save

**Fallback order**: Dealership key → Replit integration → Error

### Cost Estimates

| Feature | Approximate Cost |
|---------|-----------------|
| Customer chat | $0.01-0.02 per conversation |
| Call analysis | $0.05-0.10 per call |
| Vehicle descriptions | $0.005 per description |

---

## 8. AI Chat Configuration

### Configure Chat Prompts

1. Login as Manager or above
2. Go to **Dashboard** → **Chat Settings** (or **AI Settings**)
3. Configure:

| Setting | Description | Example |
|---------|-------------|---------|
| System Prompt | AI personality and instructions | "You are a helpful sales assistant for Olympic Hyundai..." |
| Welcome Message | First message to customers | "Hi! I'm here to help you find the perfect vehicle. What are you looking for?" |
| Max Tokens | Response length limit | 500 |
| Temperature | Creativity (0=focused, 1=creative) | 0.7 |
| Model | GPT model to use | gpt-4o-mini |

### System Prompt Best Practices

```
You are a friendly and knowledgeable sales assistant for [Dealership Name].

Your goals:
- Help customers find vehicles that match their needs
- Answer questions about our inventory
- Encourage customers to schedule test drives
- Collect contact information for follow-up

Rules:
- Be concise and helpful
- Never make up vehicle information
- If you don't know something, offer to connect them with a sales representative
- Always be professional and courteous

Our dealership specializes in [brands] and we're located at [address].
```

---

## 9. Facebook Integration

### 9.1 Facebook App Setup

#### Step 1: Create Facebook App

1. Go to [Facebook Developer Console](https://developers.facebook.com)
2. Click **"My Apps"** → **"Create App"**
3. Select **"Business"** app type
4. Fill in:
   - **App Name**: `LotView - [Dealership Name]`
   - **App Contact Email**: Your email
   - **Business Account**: Select your Facebook Business account

#### Step 2: Configure App Settings

1. Go to **App Dashboard** → **Settings** → **Basic**
2. Copy and save as secrets:
   - **App ID** → `FACEBOOK_APP_ID`
   - **App Secret** → `FACEBOOK_APP_SECRET`
3. Configure:
   - **App Domains**: `your-domain.replit.app`
   - **Privacy Policy URL**: `https://your-domain.replit.app/privacy-policy`
   - **Terms of Service URL**: `https://your-domain.replit.app/terms-of-service`
   - **App Icon**: Upload your logo

#### Step 3: Add Facebook Login Product

1. In App Dashboard, click **"Add Product"**
2. Find **"Facebook Login"** → Click **"Set Up"**
3. Choose **"Web"**
4. Configure:
   - **Valid OAuth Redirect URIs**: 
     ```
     https://your-domain.replit.app/api/facebook/oauth/callback
     ```
5. Save changes

#### Step 4: Request Permissions

In **App Review** → **Permissions and Features**, request:

| Permission | Why Needed |
|------------|------------|
| `pages_show_list` | List user's Facebook pages |
| `pages_read_engagement` | Read page engagement metrics |
| `pages_manage_posts` | Post to pages |
| `pages_read_user_content` | Read user posts on pages |
| `catalog_management` | Manage product catalogs |
| `business_management` | Manage business assets |

#### Step 5: Submit for App Review

For production use:
1. Go to **App Review** → **Requests**
2. For each permission, provide:
   - Screenshots showing the feature
   - Step-by-step instructions for reviewers
   - Video walkthrough (optional but helpful)
3. Submit for review (takes 1-5 business days)

### 9.2 Facebook OAuth Flow

#### Connecting a Facebook Page

1. In LotView, go to **Dashboard** → **Facebook** tab
2. Click **"Connect Facebook Page"**
3. You'll be redirected to Facebook
4. Login and authorize the app
5. Select the page(s) to connect
6. Grant the requested permissions
7. You're redirected back with the access token saved

#### Technical Flow

```
User clicks "Connect" 
  → Redirect to Facebook OAuth URL
  → User authorizes
  → Facebook redirects to /api/facebook/oauth/callback
  → Server exchanges code for access token
  → Token saved to database
  → User redirected to dashboard
```

### 9.3 Facebook Catalog API (for Automotive Ads)

The Catalog API enables **Facebook Automotive Inventory Ads** - dynamic ads that show your actual vehicles to interested buyers.

#### Step 1: Create a Catalog in Facebook Business Manager

1. Go to [Facebook Business Manager](https://business.facebook.com)
2. Click **"Commerce"** → **"Catalogs"**
3. Click **"Create Catalog"**
4. Select **"Automotive Inventory"** as the type
5. Name it: `[Dealership Name] Vehicles`
6. **Copy the Catalog ID** (numeric, like `123456789012345`)

#### Step 2: Create a System User

System Users are special accounts for automated API access:

1. In Business Manager, go to **Business Settings**
2. Navigate to **Users** → **System Users**
3. Click **"Add"**
4. Name: `LotView Catalog Sync`
5. Role: **Admin**

#### Step 3: Assign Catalog Access

1. Select your System User
2. Click **"Assign Assets"**
3. Choose **"Catalogs"**
4. Select your vehicle catalog
5. Grant **"Manage Catalog"** permission

#### Step 4: Generate Access Token

1. With System User selected, click **"Generate New Token"**
2. Select your App (from step 9.1)
3. Choose scopes:
   - `catalog_management`
   - `business_management`
4. Click **"Generate Token"**
5. **Copy the token immediately!** (It's very long, ~200 characters)

#### Step 5: Configure in LotView

1. Go to **Super Admin Dashboard** → **FB Catalogs** tab
2. Select the dealership
3. Enter:
   - **Catalog ID**: From Step 1
   - **System User Access Token**: From Step 4
   - **Enable Auto-Sync**: Toggle ON for daily sync at 4 AM
4. Click **"Test Connection"**
5. Click **"Save"**

#### Step 6: Sync Your Inventory

- **Manual**: Click **"Sync Now"** to immediately push inventory
- **Automatic**: Runs daily at 4 AM if auto-sync is enabled

#### Catalog Data Format

Vehicles are formatted per Facebook's [Automotive Catalog spec](https://developers.facebook.com/docs/marketing-api/catalog/guides/vehicle-catalog):

```json
{
  "id": "VIN or vehicle-123",
  "vehicle_id": "VIN or vehicle-123",
  "title": "2024 Honda Accord EX-L",
  "description": "Low mileage, one owner...",
  "price": "35999 CAD",
  "availability": "in stock",
  "condition": "used",
  "link": "https://dealer.lotview.ai/inventory/123",
  "image_link": "https://...",
  "brand": "Honda",
  "year": 2024,
  "make": "Honda",
  "model": "Accord",
  "body_style": "Sedan",
  "mileage": { "value": 15000, "unit": "KM" },
  "vin": "1HGCV1F32RA000123"
}
```

### 9.4 Facebook Marketplace Posting

#### Automatic Posting Setup

1. Connect your Facebook Page (see 9.2)
2. Go to **Dashboard** → **Facebook Posting**
3. Configure your schedule:
   - **Post Times**: When to post (e.g., 9 AM, 2 PM, 6 PM)
   - **Post Frequency**: How many per day
   - **Auto-Post New Inventory**: Automatically post new vehicles

#### Manual Posting

1. Go to **Inventory** → Click on a vehicle
2. Click **"Post to Facebook"** button
3. Edit the post content if desired
4. Select target page(s)
5. Click **"Post Now"** or **"Schedule"**

#### Posting Queue

Posts are queued and processed to avoid rate limits:
- Scheduler runs every minute
- Processes pending posts from queue
- Handles failures with retry logic
- Logs all post attempts

#### Post Templates

Configure default templates:

```
🚗 {YEAR} {MAKE} {MODEL} {TRIM}

💰 ${PRICE}
📍 {ODOMETER} km
🔧 {TRANSMISSION}

Features:
{DESCRIPTION}

📞 Call us: {PHONE}
🌐 View online: {URL}

#UsedCars #{MAKE} #{MODEL} #{CITY}
```

### 9.5 Facebook Token Management

Facebook access tokens expire. LotView handles this automatically:

#### Automatic Token Refresh

- **Schedule**: Daily at 3 AM
- **Checks**: Tokens expiring within 7 days
- **Action**: Requests long-lived token extension from Facebook
- **Updates**: Saves new token and expiry to database

#### Token Expiry Handling

| Token Type | Duration |
|------------|----------|
| Short-lived | ~1-2 hours |
| Long-lived User Token | ~60 days |
| Long-lived Page Token | Never expires (if page access granted) |
| System User Token | Never expires |

#### If Token Expires

1. User is prompted to re-authenticate
2. Go to **Facebook** tab → **"Reconnect"**
3. Complete OAuth flow again

---

## 10. PBS DMS Integration

PBS Partner Hub integration syncs contacts, appointments, and service data with your PBS Dealer Management System.

### What PBS Integration Provides

| Module | Features |
|--------|----------|
| **Sales** | Contact management, vehicle interests, appointments, workplan events |
| **Service** | Service appointments, repair orders, vehicle service history |
| **Parts** | Parts inventory search (read-only), orders, tire storage |

### Step 1: Obtain PBS Credentials

Contact your PBS representative to get:
- **Dealer ID**: Your unique dealership identifier
- **Username**: API username
- **Password**: API password
- **API Base URL**: Usually `https://api.pbsdealer.com/partnerhub`

### Step 2: Configure PBS in LotView

1. Go to **Super Admin Dashboard** → **Dealerships** → **[Dealership]**
2. Navigate to **PBS DMS** section
3. Enter:

| Field | Description |
|-------|-------------|
| PBS Dealer ID | Your PBS dealer identifier |
| PBS Username | API username |
| PBS Password | API password (stored encrypted) |
| API Base URL | PBS Partner Hub URL |

4. Click **"Test Connection"**
5. Save configuration

### Step 3: Session Management

PBS uses session-based authentication. LotView handles this automatically:

- **Session Creation**: On first API call
- **Session Caching**: Cached for 8 hours in `pbs_sessions` table
- **Auto-Refresh**: Automatic re-login on 401 errors
- **Logging**: All calls logged to `pbs_api_logs`

### Step 4: Available Operations

#### Sales Module

| Endpoint | Operation |
|----------|-----------|
| `ContactGet` | Search/retrieve contacts |
| `ContactSave` | Create new contact |
| `ContactChange` | Update existing contact |
| `ContactVehicleGet` | Get customer's vehicles |
| `WorkplanEventGet/Change` | Sales tasks and events |
| `WorkplanAppointmentGet/Change/Create` | Sales appointments |
| `WorkplanReminderGet` | Reminders |

#### Service Module

| Endpoint | Operation |
|----------|-----------|
| `AppointmentBookingGet` | Available booking slots |
| `AppointmentGet/Change/Create` | Service appointments |
| `RepairOrderGet/Change` | Repair orders |
| `AppointmentContactVehicleGet/Change` | Vehicle service history |

#### Parts Module (Read-Only)

| Endpoint | Operation |
|----------|-----------|
| `PartsInventoryGet/Search` | Search parts inventory |
| `PartsOrderGet` | Parts orders |
| `PurchaseOrderGet` | Purchase orders |
| `TireStorageGet` | Tire storage records |
| `ShopGet` | Shop information |

### PBS Caching

To reduce DMS load, LotView caches:
- Contacts: 24 hours
- Appointments: 24 hours
- Parts: 24 hours

Cache is invalidated on updates.

---

## 11. GoHighLevel CRM Integration

GoHighLevel (GHL) integration enables:
- Bidirectional contact sync
- Calendar/appointment sync
- Lead pipeline management
- Call recording analysis
- Automated follow-up triggers

### Step 1: Create GHL OAuth App

1. Go to [GHL Marketplace](https://marketplace.gohighlevel.com)
2. Click **"Build"** → **"Create App"**
3. Choose **Private App** (for single agency) or **Public App** (for marketplace)
4. Fill in:
   - **App Name**: `LotView CRM Sync`
   - **Description**: Vehicle inventory CRM integration
   - **Redirect URI**: `https://your-domain.replit.app/api/ghl/auth/callback`

### Step 2: Configure Scopes

Request these OAuth scopes:

| Scope | Purpose |
|-------|---------|
| `contacts.readonly` | Read contacts |
| `contacts.write` | Create/update contacts |
| `calendars.readonly` | Read calendars |
| `calendars.write` | Create calendars |
| `calendars/events.readonly` | Read appointments |
| `calendars/events.write` | Create/update appointments |
| `opportunities.readonly` | Read pipeline opportunities |
| `opportunities.write` | Create/update opportunities |
| `locations.readonly` | Read location info |
| `users.readonly` | Read team members |

### Step 3: Set GHL Secrets in Replit

```
GHL_CLIENT_ID=your-client-id
GHL_CLIENT_SECRET=your-client-secret
GHL_REDIRECT_URI=https://your-domain.replit.app/api/ghl/auth/callback
```

### Step 4: Connect GHL Account

1. Go to **Super Admin Dashboard** → **GHL Integration** (or dealership settings)
2. Click **"Connect GoHighLevel"**
3. Select your GHL sub-account (location)
4. Authorize the requested permissions
5. Callback saves OAuth tokens to `ghl_accounts` table

### Step 5: Configure Sync Settings

After connecting:

1. Go to GHL settings for the dealership
2. Configure:

| Setting | Description |
|---------|-------------|
| Sales Calendar | GHL calendar for sales appointments |
| Service Calendar | GHL calendar for service appointments |
| Lead Pipeline | GHL pipeline for new leads |
| Opportunity Stage | Default stage for new opportunities |
| Bidirectional Sync | Enable two-way sync |
| Sync Interval | How often to sync (default: daily at 5 AM) |

### Step 6: Webhook Setup (for Real-Time Sync)

GHL can send events to LotView in real-time:

1. In GHL, go to **Settings** → **Webhooks**
2. Click **"Add Webhook"**
3. Set URL: `https://your-domain.replit.app/api/ghl/webhook`
4. Select events:
   - `ContactCreate`
   - `ContactUpdate`
   - `AppointmentCreate`
   - `AppointmentUpdate`
   - `CallCompleted` (for call analysis)
5. Copy the **Webhook Signing Secret** (if available)
6. Save in LotView's GHL config

### Step 7: Token Refresh

GHL tokens expire after ~24 hours. LotView handles this:
- Tokens refreshed automatically before expiry
- 5-minute buffer before expiration
- Failed refreshes logged for troubleshooting

---

## 12. Call Analysis Setup

AI-powered call analysis scores sales calls and provides coaching insights.

### Prerequisites

- [ ] GoHighLevel integration configured
- [ ] OpenAI API access (Replit or per-dealership)
- [ ] Call recording enabled in GHL

### Step 1: Enable Call Tracking in GHL

1. In GHL, go to **Settings** → **Phone Numbers**
2. Ensure call recording is enabled for your numbers
3. Verify calls are being recorded

### Step 2: Configure Call Webhook

GHL sends `CallCompleted` events when calls end:

1. In GHL webhooks (from Step 6 above), ensure `CallCompleted` is selected
2. The webhook includes:
   - Recording URL
   - Duration
   - Caller/callee information
   - Direction (inbound/outbound)

LotView endpoint: `POST /api/ghl/call-webhook`

### Step 3: Default Analysis Criteria

LotView comes with default scoring criteria:

| Criterion | Weight | What It Measures |
|-----------|--------|-----------------|
| Greeting & Introduction | 15 | Professional phone greeting |
| Needs Discovery | 20 | Understanding customer needs |
| Product Knowledge | 15 | Vehicle expertise demonstrated |
| Objection Handling | 15 | Addressing customer concerns |
| Closing Techniques | 20 | Asking for the appointment/sale |
| Follow-up Commitment | 15 | Scheduling next steps |

### Step 4: Customize Criteria

1. Login as Manager or above
2. Go to **Dashboard** → **Call Analysis**
3. Click **"Manage Criteria"**
4. Add/edit/delete criteria:

| Field | Description |
|-------|-------------|
| Name | Criterion name |
| Description | What AI should evaluate |
| Weight | Importance (0-100, must total 100) |
| Active | Enable/disable |

### Step 5: Seed Default Criteria

For new dealerships:
1. Go to **Call Analysis** → **Manage Criteria**
2. Click **"Seed Default Criteria"**
3. Defaults are added to database

### Step 6: Review Call Scores

1. Go to **Dashboard** → **Call Analysis**
2. View:
   - **Call List**: All recorded calls with scores
   - **Filters**: By salesperson, date range, score range, needs review
   - **Detail View**: Individual call analysis
   - **Coaching Tips**: AI-generated improvement suggestions

### Call Analysis Features

| Feature | Description |
|---------|-------------|
| Overall Score | Weighted average of all criteria (0-100) |
| Criterion Breakdown | Score per criterion with notes |
| Strengths | What went well |
| Improvements | Areas to work on |
| Coaching Tips | Specific suggestions |
| Needs Review Flag | Manager can flag for discussion |
| Transcription | Full call transcript (if available) |

---

## 13. Inventory Scraping

LotView can automatically pull vehicle inventory from various sources.

### 13.1 AutoTrader.ca Scraping

#### Direct Puppeteer Scraping

AutoTrader.ca uses Cloudflare protection. LotView uses:
- Puppeteer with stealth plugins
- User agent rotation
- Challenge page handling
- Proxy support (optional)

#### Configuration

1. Find your AutoTrader dealer ID (from your listing URL)
2. Configure in **Settings** → **Inventory Sources**
3. Add AutoTrader.ca with dealer URL

#### Cloudflare Bypass

If blocked:
- Configure proxies in `SCRAPER_PROXIES` env var
- Use Apify integration (more reliable)

### 13.2 CarGurus Scraping

CarGurus is scraped using Cheerio (HTML parsing):

1. Find your CarGurus dealer listing URL
2. Configure in **Settings** → **Inventory Sources**
3. Scraper extracts: VIN, price, mileage, images, descriptions

### 13.3 Apify Integration

For reliable, cloud-based scraping:

#### Step 1: Get Apify Credentials

1. Create account at [apify.com](https://apify.com)
2. Get **API Token** from Account → Integrations
3. Find or create an AutoTrader.ca Actor

#### Step 2: Configure in LotView

Add to Replit Secrets:
```
APIFY_API_TOKEN=your-api-token
APIFY_AUTOTRADER_ACTOR_ID=your-actor-id
```

Or configure per-dealership in **API Keys** settings.

#### How It Works

1. LotView triggers Apify Actor with dealer URL
2. Actor runs in Apify cloud
3. Results returned via API
4. Vehicles parsed and saved to database

### 13.4 Custom Dealer Website Scraping

For other websites, customize `server/scraper.ts`:

1. Open `server/scraper.ts`
2. Find the `DEALERSHIPS` configuration
3. Update selectors for your website's HTML structure

Example:
```typescript
$('.vehicle-listing').each((i, elem) => {
  const year = parseInt($(elem).find('.vehicle-year').text());
  const make = $(elem).find('.vehicle-make').text();
  const model = $(elem).find('.vehicle-model').text();
  const price = parseInt($(elem).find('.price').text().replace(/[^0-9]/g, ''));
  // ... extract all fields
});
```

### Scraper Schedule

- **Automatic**: Runs daily at midnight
- **Manual**: **Dashboard** → **Inventory** → **"Sync Now"**

### Badge Detection

Scraper automatically detects badges from descriptions:

| Badge | Keywords Detected |
|-------|-------------------|
| One Owner | "one owner", "1 owner", "single owner" |
| No Accidents | "no accidents", "accident free", "clean history" |
| Clean Title | "clean title", "clear title" |
| Certified Pre-Owned | "certified", "cpo", "certified pre-owned" |
| Low Kilometers | "low km", "low kilometers", "low mileage" |

---

## 14. Market Pricing & Analysis

### MarketCheck API

Provides competitive market data:

#### Step 1: Get API Key

1. Sign up at [marketcheck.com](https://www.marketcheck.com)
2. Choose a plan (free tier available)
3. Copy API key from dashboard

#### Step 2: Configure

Add secret: `MARKETCHECK_API_KEY=your-api-key`

Or per-dealership in **API Keys** settings.

#### Features

| Feature | Description |
|---------|-------------|
| Price Comparison | How your price compares to market |
| Days on Market | Average time to sell similar vehicles |
| Price Trending | Is price going up or down |
| Competitive Listings | Similar vehicles for sale |

### Geocoder.ca (Canadian Addresses)

For address geocoding and distance calculations:

```
GEOCODER_CA_USERNAME=your-username
GEOCODER_CA_PASSWORD=your-password
```

Used for:
- Customer location detection
- Delivery distance calculations
- Regional pricing analysis

### AI Market Summaries

OpenAI generates natural language market summaries:
- Price positioning
- Demand trends
- Recommended actions

---

## 15. Subdomain Configuration

Each dealership can have a custom subdomain like `olympic.lotview.ai`.

### Current Setup (Replit)

1. Go to **Super Admin Dashboard** → **Dealerships**
2. Set the **Subdomain** field (e.g., `olympic-hyundai`)
3. The app routes based on subdomain

### How Tenant Resolution Works

The system resolves which dealership to serve via:

1. **JWT Token**: Logged-in user's dealership (highest priority)
2. **Subdomain**: Extracted from request host
3. **X-Dealership-ID Header**: For API testing
4. **Default**: Falls back to dealership ID 1

### Custom Domain Setup (Production)

For your own domain:

1. In Replit, go to **Deployments** → **Domains**
2. Add your custom domain (e.g., `lotview.ai`)
3. Configure DNS at your registrar:

```
Type: A
Name: @
Value: [Replit's IP - shown in deployment settings]

Type: CNAME
Name: *
Value: [Your Replit deployment URL]
```

4. SSL is auto-provisioned by Replit

### Subdomain Routing Example

| URL | Resolves To |
|-----|-------------|
| `lotview.ai` | Marketing landing page |
| `olympic.lotview.ai` | Olympic Auto Group inventory |
| `boundary.lotview.ai` | Boundary Hyundai inventory |
| `kia.lotview.ai` | Kia Vancouver inventory |

---

## 16. SEO Configuration

### Meta Tags

Edit `client/index.html` for global defaults:

```html
<title>LotView.ai - AI-Powered Vehicle Inventory</title>
<meta name="description" content="Browse our selection of quality vehicles with AI-powered search and financing tools." />
<meta property="og:title" content="LotView.ai" />
<meta property="og:description" content="Find your perfect vehicle with AI assistance" />
<meta property="og:image" content="https://your-domain.replit.app/og-image.jpg" />
<meta name="twitter:card" content="summary_large_image" />
```

### Per-Dealership SEO

Customize in dealership settings:
- Page titles (include dealership name)
- Meta descriptions
- Open Graph images
- Local business schema

### Structured Data (Schema.org)

LotView automatically generates structured data:

```json
{
  "@context": "https://schema.org",
  "@type": "Vehicle",
  "name": "2024 Honda Accord EX-L",
  "brand": "Honda",
  "model": "Accord",
  "vehicleModelDate": "2024",
  "mileageFromOdometer": {
    "@type": "QuantitativeValue",
    "value": 15000,
    "unitCode": "KMT"
  },
  "offers": {
    "@type": "Offer",
    "price": 35999,
    "priceCurrency": "CAD"
  }
}
```

### Sitemap

Generate sitemap at `/sitemap.xml`:
- All vehicle listing pages
- Category pages
- Legal pages
- Updated automatically when inventory changes

---

## 17. Google Analytics & Remarketing

### Google Tag Manager (GTM)

#### Step 1: Create GTM Container

1. Go to [tagmanager.google.com](https://tagmanager.google.com)
2. Create account → Create container
3. Choose **"Web"** as platform
4. Copy Container ID (format: `GTM-XXXXXXX`)

#### Step 2: Configure in LotView

1. **Super Admin** → **Dealership** → **Integrations**
2. Enter GTM Container ID
3. Save

### Google Analytics 4 (GA4)

#### Step 1: Create GA4 Property

1. Go to [analytics.google.com](https://analytics.google.com)
2. Admin → Create Property
3. Follow setup wizard
4. Copy Measurement ID (format: `G-XXXXXXXXXX`)

#### Step 2: Configure

1. **Super Admin** → **Dealership** → **Integrations**
2. Enter Google Analytics ID
3. Save

### Google Ads Remarketing

#### Step 1: Get Remarketing Tag

1. Go to [ads.google.com](https://ads.google.com)
2. Tools & Settings → Audience Manager
3. Copy Remarketing Tag ID (format: `AW-XXXXXXXXX`)

#### Step 2: Configure

1. **Super Admin** → **Dealership** → **Integrations**
2. Enter Google Ads ID
3. Save

### Facebook Pixel

#### Step 1: Create Pixel

1. Go to [Facebook Events Manager](https://www.facebook.com/events_manager)
2. Connect Data Sources → Web → Facebook Pixel
3. Name your pixel
4. Copy Pixel ID (numeric, like `123456789012345`)

#### Step 2: Configure

1. **Super Admin** → **Dealership** → **Integrations**
2. Enter Facebook Pixel ID
3. Save

### Events Tracked

| Event | When Triggered |
|-------|----------------|
| `PageView` | Every page load |
| `ViewContent` | Vehicle detail page |
| `Search` | Inventory search/filter |
| `Lead` | Form submission |
| `InitiateCheckout` | Financing calculator use |
| `Contact` | Chat started |

---

## 18. Object Storage Setup

LotView uses Replit Object Storage for file uploads.

### Auto-Configured

Replit automatically provides:
- `DEFAULT_OBJECT_STORAGE_BUCKET_ID` - Bucket identifier
- `PUBLIC_OBJECT_SEARCH_PATHS` - Public file paths
- `PRIVATE_OBJECT_DIR` - Private uploads directory

### Directory Structure

```
bucket/
├── public/          # Publicly accessible files
│   ├── logos/       # Dealership logos
│   └── vehicles/    # Vehicle images
└── .private/        # Private files
    └── uploads/     # User uploads
```

### Uploading Images

Images are stored when:
1. **Scraping**: Auto-downloaded from source websites
2. **Manual Upload**: Dashboard → Add Vehicle → Upload Images
3. **API**: `POST /api/vehicles/:id/images`

---

## 19. Scheduled Jobs & Cron Tasks

All scheduled jobs use `node-cron`:

| Schedule | Job | Description |
|----------|-----|-------------|
| `0 0 * * *` | Inventory Sync | Midnight - Scrape and update inventory |
| `0 3 * * *` | Facebook Token Refresh | 3 AM - Refresh expiring tokens |
| `0 3 * * *` | Market Analysis | 3 AM - Update market pricing data |
| `0 4 * * *` | Facebook Catalog Sync | 4 AM - Sync inventory to Facebook Catalog |
| `0 5 * * *` | GHL CRM Sync | 5 AM - Bidirectional CRM reconciliation |
| `* * * * *` | Facebook Posting Queue | Every minute - Process pending posts |

### Enable/Disable Scheduler

Set environment variable:
```
SCHEDULER_ENABLED=true   # Enable all scheduled jobs
SCHEDULER_ENABLED=false  # Disable all scheduled jobs
```

### Monitoring Jobs

Check job execution in:
1. **Server logs**: Replit console output
2. **Database tables**: `pbs_api_logs`, `ghl_api_logs`
3. **Audit logs**: `audit_logs` table

---

## 20. Publishing & Deployment

### Development Mode

The app runs on port 5000 with Vite dev server for hot reload.

### Production Deployment

1. Click **"Publish"** button in Replit (top right)
2. Choose deployment type:
   - **Autoscale** (recommended) - Scales with traffic
   - **Reserved VM** - Dedicated resources
3. Click **"Publish"**

Replit handles:
- Building React frontend
- Bundling Express server with esbuild
- SSL/TLS certificates
- Health checks
- Custom domains

### Post-Deployment Checklist

- [ ] All secrets are set for production
- [ ] Database migrations applied
- [ ] Facebook OAuth redirects updated to production URL
- [ ] GHL webhooks updated to production URL
- [ ] Facebook App domains updated
- [ ] SSL certificate active
- [ ] Custom domain configured (if applicable)

---

## 21. Updating Without Losing Data

### What Persists (Safe)

| Data | Storage | Survives Updates |
|------|---------|------------------|
| All database tables | PostgreSQL | ✅ Yes |
| Vehicles, users, settings | Database | ✅ Yes |
| API keys | Database (encrypted) | ✅ Yes |
| Chat conversations | Database | ✅ Yes |
| Call recordings | Database + Object Storage | ✅ Yes |
| Uploaded images | Object Storage | ✅ Yes |

### What Does NOT Persist

- Files in filesystem (use Object Storage)
- In-memory caches (rebuilt on restart)

### Safe Update Process

1. Make code changes in Replit
2. Test thoroughly in development
3. Click **"Republish"**
4. Database data is preserved
5. Only code is updated

### Database Migrations

New columns/tables are automatically added on deploy via Drizzle ORM. Existing data is never deleted.

### Rollback If Needed

1. In Replit, use **History** tab
2. Click **"Rollback"**
3. Choose a previous checkpoint
4. Database can be restored too

---

## 22. Troubleshooting

### Common Issues

#### "Database connection failed"
- Check `DATABASE_URL` secret is set
- Verify Neon database is not paused (free tier pauses after inactivity)

#### "Facebook OAuth error"
- Verify `FACEBOOK_APP_ID` and `FACEBOOK_APP_SECRET`
- Check redirect URI matches exactly in Facebook App settings
- Ensure app is in **Live** mode (not Development) for production

#### "Facebook token expired"
- Go to **Facebook** tab → **"Reconnect"**
- Complete OAuth flow again

#### "PBS API 401 Unauthorized"
- Session expired - will auto-refresh
- Verify credentials are correct
- Check PBS account is active

#### "GHL token refresh failed"
- Re-authenticate: **GHL Integration** → **"Reconnect"**
- Check `GHL_CLIENT_ID` and `GHL_CLIENT_SECRET`

#### "Scraper blocked by Cloudflare"
- Use Apify integration instead
- Configure proxies in `SCRAPER_PROXIES`
- Wait and retry (rate limiting)

#### "Call analysis not working"
- Verify OpenAI API key is configured
- Check GHL webhook is sending `CallCompleted` events
- Ensure call recording is enabled in GHL

#### "Chat not responding"
- Check OpenAI API key
- Verify key has credits remaining
- Check browser console for errors

### Log Locations

| Log Type | Location |
|----------|----------|
| Server logs | Replit console output |
| PBS API logs | `pbs_api_logs` table |
| GHL API logs | `ghl_api_logs` table |
| Audit logs | `audit_logs` table |
| Impersonation logs | `impersonation_sessions` table |

---

## 23. Quick Reference: All Secrets

```bash
# ============================================
# REQUIRED SECRETS
# ============================================

# Database (auto-configured by Replit)
DATABASE_URL=postgresql://...

# Authentication (generate with: openssl rand -hex 32)
JWT_SECRET=your-jwt-secret-64-chars-minimum
SESSION_SECRET=your-session-secret

# ============================================
# FACEBOOK INTEGRATION
# ============================================
FACEBOOK_APP_ID=your-facebook-app-id
FACEBOOK_APP_SECRET=your-facebook-app-secret
FACEBOOK_REDIRECT_URI=https://your-domain.replit.app/api/facebook/oauth/callback

# ============================================
# GOHIGHLEVEL CRM
# ============================================
GHL_CLIENT_ID=your-ghl-client-id
GHL_CLIENT_SECRET=your-ghl-client-secret
GHL_REDIRECT_URI=https://your-domain.replit.app/api/ghl/auth/callback

# ============================================
# OPENAI (auto-configured by Replit)
# ============================================
AI_INTEGRATIONS_OPENAI_API_KEY=auto-configured
AI_INTEGRATIONS_OPENAI_BASE_URL=auto-configured

# ============================================
# OPTIONAL APIs (can be per-dealership)
# ============================================
MARKETCHECK_API_KEY=your-marketcheck-api-key
APIFY_API_TOKEN=your-apify-token
APIFY_AUTOTRADER_ACTOR_ID=your-actor-id
GEOCODER_CA_USERNAME=your-username
GEOCODER_CA_PASSWORD=your-password
SCRAPER_PROXIES=http://proxy1:port,http://proxy2:port

# ============================================
# OBJECT STORAGE (auto-configured by Replit)
# ============================================
DEFAULT_OBJECT_STORAGE_BUCKET_ID=auto-configured
PUBLIC_OBJECT_SEARCH_PATHS=auto-configured
PRIVATE_OBJECT_DIR=auto-configured

# ============================================
# SCHEDULER
# ============================================
SCHEDULER_ENABLED=true
```

---

## Support

For additional support:
- Check `replit.md` for architecture details
- Review server code in `/server` directory
- Database schema in `shared/schema.ts`
- Contact your system administrator

---

*Last Updated: December 2024*
*LotView.ai - AI-Powered Automotive Inventory Platform*
