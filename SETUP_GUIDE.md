# Olympic Auto Group - Complete Setup & Integration Guide

This guide covers all API integrations, how they work, how to configure them, and how to publish your application.

---

## TABLE OF CONTENTS

1. [Super Admin Access](#1-super-admin-access)
2. [API Integrations Overview](#2-api-integrations-overview)
3. [OpenAI Integration (AI Chat & Descriptions)](#3-openai-integration)
4. [GoHighLevel Integration (GHL CRM)](#4-gohighlevel-integration)
5. [Facebook Integration (Marketplace Posting)](#5-facebook-integration)
6. [MarketCheck Integration (Market Pricing)](#6-marketcheck-integration)
7. [Apify Integration (AutoTrader Scraping)](#7-apify-integration)
8. [Google Analytics & Tag Manager](#8-google-analytics--tag-manager)
9. [Google Ads Remarketing](#9-google-ads-remarketing)
10. [Facebook Pixel Remarketing](#10-facebook-pixel-remarketing)
11. [Publishing Your Application](#11-publishing-your-application)
12. [Updating Without Losing Data](#12-updating-without-losing-data)
13. [Creating Future Versions](#13-creating-future-versions)

---

## 1. SUPER ADMIN ACCESS

### Login Credentials
- **URL**: Your app URL + `/login`
- **Email**: `superadmin@olympicauto.com`
- **Password**: (the password you set up)

### What Super Admin Can Do
- Manage all dealerships
- Configure API keys for each dealership
- View audit logs of all changes
- Create/manage master users for each dealership

---

## 2. API INTEGRATIONS OVERVIEW

All API keys are managed in the **Super Admin Dashboard** under the **Integrations** tab.

### How to Access
1. Login as Super Admin
2. Click on a dealership in the Dealerships tab
3. Click the "Configure Integrations" button (plug icon)
4. Enter API keys in the form

### Key Storage
- All API keys are stored encrypted in the database
- Each dealership can have their own API keys
- System falls back to default keys if dealership-specific not set

---

## 3. OPENAI INTEGRATION

### What It Does
- Powers the website AI chatbot
- Generates vehicle descriptions automatically
- Provides intelligent responses to customer questions

### How It's Wired
```
Customer sends message → Server receives → OpenAI API called → Response sent back
```

**File**: `server/openai.ts`
- First checks for dealership-specific key in database
- Falls back to Replit's AI Integrations if no key set

### How to Get an API Key
1. Go to https://platform.openai.com/
2. Sign up or login
3. Go to API Keys section
4. Create a new secret key
5. Copy the key (starts with `sk-`)

### How to Configure
1. Login as Super Admin
2. Go to Dealerships → Select a dealership → Integrations
3. Paste your OpenAI API key in the "OpenAI API Key" field
4. Click Save

### Cost
- Pay per token (roughly $0.002 per 1000 tokens)
- Average chat costs ~$0.01-0.02 per conversation

### Testing
- The system has a "Test Connection" feature
- Or simply use the chat widget on a vehicle page

---

## 4. GOHIGHLEVEL INTEGRATION

### What It Does
- **Syncs website chat conversations to GHL contacts**
- **Sends leads from CTAs (Test Drive, Reserve, Get Approved)**
- **Enables SMS/Email follow-up from GHL**
- **Tracks all customer interactions in one CRM**

### How It's Wired
```
Customer interaction → Website chat/CTA → GHL Contact created → 
Conversation synced → Staff follows up via GHL SMS/Email
```

**Files**:
- `server/ghl-client.ts` - API client for GHL
- `server/routes.ts` - Webhook endpoints

### How to Get API Key & Location ID

#### Step 1: Get Your GHL Location ID
1. Login to GoHighLevel (https://app.gohighlevel.com/)
2. Go to Settings → Business Info
3. Your Location ID is in the URL: `app.gohighlevel.com/location/XXXXXXXXXXXXXXX`
4. Copy the ID after `/location/`

#### Step 2: Get Your API Key
1. In GHL, go to Settings → API Keys
2. Click "Create API Key"
3. Name it "Olympic Auto Website"
4. Select these permissions:
   - Contacts: Read/Write
   - Conversations: Read/Write
   - Messages: Read/Write
   - Opportunities: Write
5. Copy the generated key

### How to Configure
1. Login as Super Admin
2. Go to Dealerships → Select dealership → Integrations
3. Enter:
   - **GHL API Key**: Your API key from above
   - **GHL Location ID**: Your location ID from above
4. Click Save

### Setting Up Webhooks (for incoming replies)
1. In GHL, go to Settings → Webhooks
2. Create a new webhook
3. Set URL to: `https://your-app-url.replit.app/api/ghl/webhook`
4. Select events: `contact.created`, `message.received`
5. Copy the webhook secret

### What Gets Synced
- Customer name, email, phone
- All chat messages (website → GHL)
- Lead source and interested vehicle
- Tags for follow-up automation

---

## 5. FACEBOOK INTEGRATION

### What It Does
- Posts vehicles to Facebook Marketplace
- Schedules automatic posting
- Manages multiple Facebook pages per dealership

### How It's Wired
```
Vehicle in inventory → Scheduled post → Facebook API → Published to Marketplace
```

**Files**:
- `server/facebook-service.ts` - Facebook API client
- `server/scheduler.ts` - Automated posting scheduler

### How to Set Up

#### Step 1: Create a Facebook App
1. Go to https://developers.facebook.com/
2. Click "My Apps" → "Create App"
3. Choose "Business" type
4. Name it (e.g., "Olympic Auto Inventory")
5. Note the App ID and App Secret

#### Step 2: Configure App Permissions
1. In your app, go to "Add Products"
2. Add "Facebook Login"
3. Add "Marketing API"
4. Add required permissions:
   - `pages_manage_posts`
   - `pages_read_engagement`
   - `catalog_management`

#### Step 3: Add to Platform
1. In Super Admin → Dealership → Integrations
2. Enter Facebook App ID and App Secret
3. Save

#### Step 4: Connect Facebook Account
1. Login as Master user for the dealership
2. Go to Facebook tab in dashboard
3. Click "Connect Facebook Account"
4. Authorize the app to access your pages
5. Select which pages to post to

### Posting Schedule
- Configure in the Facebook tab
- Set posting frequency and times
- System automatically queues and posts

---

## 6. MARKETCHECK INTEGRATION

### What It Does
- Provides market pricing data for vehicles
- Shows competitive analysis
- Helps with pricing decisions

### How to Get API Key
1. Go to https://www.marketcheck.com/
2. Sign up for API access
3. Choose a plan (they have free tiers)
4. Copy your API key

### How to Configure
1. Super Admin → Dealership → Integrations
2. Enter MarketCheck API Key
3. Save

### How It's Used
- Sales Manager tools use this for pricing analysis
- VIN decoder enhancement
- Market comparison features

---

## 7. APIFY INTEGRATION

### What It Does
- Scrapes AutoTrader.ca for additional vehicle data
- Enriches inventory with market information
- Automated data collection

### How to Set Up
1. Go to https://apify.com/
2. Create an account
3. Get your API token from Settings → Integrations → API
4. Find the AutoTrader.ca actor ID

### How to Configure
1. Super Admin → Dealership → Integrations
2. Enter:
   - **Apify Token**: Your API token
   - **Apify Actor ID**: The actor ID for AutoTrader scraping
3. Save

---

## 8. GOOGLE ANALYTICS & TAG MANAGER

### What It Does
- Tracks website visitors
- Measures conversions (inquiries, chat starts, etc.)
- Provides insights on vehicle interest

### Google Tag Manager Setup

#### Step 1: Create GTM Container
1. Go to https://tagmanager.google.com/
2. Create account → Create container
3. Choose "Web" as platform
4. Copy Container ID (looks like `GTM-XXXXXXX`)

#### Step 2: Configure in Platform
1. Super Admin → Dealership → Integrations
2. Enter GTM Container ID
3. Save

### Google Analytics 4 Setup

#### Step 1: Create GA4 Property
1. Go to https://analytics.google.com/
2. Admin → Create Property
3. Follow setup wizard
4. Copy Measurement ID (looks like `G-XXXXXXXXXX`)

#### Step 2: Configure in Platform
1. Super Admin → Dealership → Integrations
2. Enter Google Analytics ID
3. Save

### What Gets Tracked
- Page views (including vehicle detail pages)
- Chat widget opens
- CTA button clicks
- Vehicle inquiries
- Time on page

---

## 9. GOOGLE ADS REMARKETING

### What It Does
- Tracks visitors who viewed specific vehicles
- Enables showing ads to those visitors later
- Dynamic remarketing with vehicle info

### Setup

#### Step 1: Get Google Ads ID
1. Go to https://ads.google.com/
2. Tools & Settings → Audience Manager
3. Your Remarketing Tag ID looks like `AW-XXXXXXXXX`

#### Step 2: Configure
1. Super Admin → Dealership → Integrations
2. Enter Google Ads ID
3. Save

### Events Tracked
- Vehicle page views (with VIN, price, make, model)
- Add to wishlist
- Inquiry submissions

---

## 10. FACEBOOK PIXEL REMARKETING

### What It Does
- Similar to Google Ads but for Facebook/Instagram
- Dynamic ads showing vehicles users viewed
- Audience building for targeting

### Setup

#### Step 1: Create Facebook Pixel
1. Go to Facebook Events Manager
2. Click "Connect Data Sources" → "Web"
3. Choose "Facebook Pixel"
4. Name your pixel
5. Copy Pixel ID (numeric, like `123456789012345`)

#### Step 2: Configure
1. Super Admin → Dealership → Integrations
2. Enter Facebook Pixel ID
3. Save

### Events Tracked
- PageView
- ViewContent (vehicle details)
- Lead (inquiries)
- Custom events for chat and CTAs

---

## 11. PUBLISHING YOUR APPLICATION

### Step-by-Step Publishing

#### Step 1: Verify Everything Works
1. Test the website thoroughly
2. Make sure all features work
3. Verify API integrations are connected

#### Step 2: Publish
1. In Replit, click the "Publish" button (top right)
2. Choose "Autoscale" deployment (recommended)
3. Click "Publish"

#### Step 3: Wait for Deployment
- Replit will build your app
- This takes 2-5 minutes
- You'll get a live URL when done

### Custom Domain (Optional)
1. Go to your deployment settings
2. Click "Custom Domains"
3. Add your domain (e.g., `inventory.olympicauto.com`)
4. Add the DNS records to your domain registrar
5. Wait for SSL certificate (automatic)

---

## 12. UPDATING WITHOUT LOSING DATA

### What Persists
- **Database**: All your data is stored in PostgreSQL - it survives updates
- **Vehicles, Users, Settings**: All stored in database - safe
- **API Keys**: Stored in database - safe

### What Does NOT Persist
- Files uploaded to the filesystem (use Object Storage instead)
- Temporary caches

### How to Update Safely

#### Step 1: Make Changes in Development
1. Make your code changes in Replit
2. Test thoroughly in development mode
3. Verify everything works

#### Step 2: Republish
1. Click "Publish" again
2. Choose "Republish"
3. Your database data is preserved
4. Only code changes are deployed

### Database Migrations
- If you add new database columns/tables, they're automatically added on deploy
- Existing data is preserved
- Replit handles this automatically

---

## 13. CREATING FUTURE VERSIONS

### Version Control with Checkpoints

Replit automatically creates checkpoints as you work. To restore:
1. Click the "History" tab
2. Browse previous versions
3. Click to restore any checkpoint

### Safe Development Workflow

#### For Minor Updates
1. Make changes in development
2. Test locally
3. Republish

#### For Major Updates
1. **Create a checkpoint** before starting (History → Create Checkpoint)
2. Make your changes
3. Test thoroughly
4. If something breaks, restore the checkpoint
5. If all good, republish

### Adding New Features Without Breaking Existing

#### Best Practice
1. Add new database columns as nullable first
2. Deploy
3. Backfill data if needed
4. Make columns required later if needed

#### Example: Adding a New Field
```typescript
// 1. Add as nullable
newField: text("new_field"),  // No .notNull()

// 2. Deploy, verify, then later:
newField: text("new_field").notNull().default("default_value"),
```

### Backup Strategy
1. **Code**: Git automatically tracks all changes
2. **Database**: Use Replit's checkpoint system
3. **Critical Data**: Export periodically via SQL

### Rollback If Needed
1. In Replit, use the "Rollback" feature
2. Choose a previous deployment
3. Your database can be restored to that point too

---

## QUICK REFERENCE

### API Keys Needed

| Integration | Where to Get | What It Does |
|------------|--------------|--------------|
| OpenAI | platform.openai.com | AI chat & descriptions |
| GHL API Key | GHL Settings → API | CRM integration |
| GHL Location ID | GHL URL | Identifies your location |
| Facebook App ID | developers.facebook.com | Marketplace posting |
| Facebook App Secret | developers.facebook.com | Marketplace posting |
| MarketCheck | marketcheck.com | Pricing data |
| Apify Token | apify.com | AutoTrader scraping |
| GTM Container ID | tagmanager.google.com | Tag management |
| Google Analytics ID | analytics.google.com | Website analytics |
| Google Ads ID | ads.google.com | Remarketing |
| Facebook Pixel ID | Facebook Events Manager | Remarketing |

### Support Contacts
- Replit Support: support.replit.com
- OpenAI: help.openai.com
- GoHighLevel: gohighlevel.com/support
- Facebook Developer: developers.facebook.com/support

---

## TROUBLESHOOTING

### "API Key Not Working"
1. Check key is copied correctly (no extra spaces)
2. Verify the key is active in the provider's dashboard
3. Use "Test Connection" button to diagnose

### "Chat Not Responding"
1. Check OpenAI API key is configured
2. Verify key has credits/quota remaining
3. Check browser console for errors

### "GHL Not Syncing"
1. Verify API key and Location ID
2. Check webhook is configured correctly
3. Test with a simple lead first

### "Facebook Posts Failing"
1. Re-authorize the Facebook connection
2. Check page permissions are granted
3. Verify Facebook App is approved

---

*Last Updated: November 2025*
