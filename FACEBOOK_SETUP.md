# Meta Messenger + Marketplace Setup

This guide covers compliant Page messaging automation, Business login, and the Marketplace copilot workflow.

## Step 1: Create a Meta App (Business)

1. Go to [Meta for Developers](https://developers.facebook.com/)
2. Create an app and select Business type
3. Add these products:
   - Facebook Login
   - Messenger
   - Webhooks

## Step 2: Configure OAuth

1. In Facebook Login settings, add OAuth redirect URI:
   - https://your-domain.com/api/facebook/oauth/callback
2. Request permissions (App Review):
   - business_management
   - pages_show_list
   - pages_read_engagement
   - pages_messaging
   - pages_manage_posts
   - pages_manage_metadata
   - catalog_management (only if using Catalog sync)

## Step 3: Set Environment Variables

FACEBOOK_APP_ID=your_app_id_here
FACEBOOK_APP_SECRET=your_app_secret_here
FACEBOOK_REDIRECT_URI=https://your-domain.com/api/facebook/oauth/callback
FACEBOOK_WEBHOOK_VERIFY_TOKEN=your_webhook_verify_token
MARKETPLACE_AUTOMATION_ENABLED=false
MARKETPLACE_PARTNER_APPROVED=false
MARKETPLACE_PUBLISHER_PROVIDER=meta_partner

Marketplace auto-posting must remain false unless you are a Marketplace Partner.
Set MARKETPLACE_PARTNER_APPROVED=true only after approval.

## Step 4: Connect Business + Pages

1. Log in as a manager/admin
2. Go to Manager -> Settings -> Meta Business Connect
3. Click Connect Business and authorize with a Business Admin account
4. Pages will sync into LotView automatically

## Step 5: Add System User Token

1. In Meta Business Manager, create a System User
2. Assign Page assets to the System User
3. Generate a System User token
4. Paste the token into the Business Connection card in LotView

## Step 6: Configure Webhooks

1. In Meta App Dashboard -> Webhooks
2. Callback URL: https://your-domain.com/webhooks/meta
3. Verify token: your FACEBOOK_WEBHOOK_VERIFY_TOKEN
4. Subscribe to Page fields:
   - messages
   - message_deliveries
   - message_reads
   - messaging_postbacks
5. Optional: In LotView, click "Subscribe Pages" to auto-register Page webhooks.

## Step 7: Route Pages + DM Links

In Manager -> Settings:
1. Assign each Page to a rooftop
2. Save a Page DM link for Marketplace CTA
3. Set a dealership-level fallback Page DM link

## Step 8: Marketplace Copilot Workflow

Use Marketplace Blast:
1. Generate listing content
2. Copy + post manually
3. Mark as posted with a listing URL

The Page DM link is injected into the listing description so buyers contact your Page.

## Troubleshooting

### Redirect URI mismatch
- Confirm the exact OAuth redirect URI in Meta settings.

### Webhook verification fails
- Ensure FACEBOOK_WEBHOOK_VERIFY_TOKEN matches the verify token in Meta Webhooks.

### Messaging fails outside 24 hours
- Meta policy restricts replies outside the 24-hour window.
- Encourage Page DM and respond quickly.
