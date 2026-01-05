# Web Scraper Documentation

## Overview

The inventory scraper automatically pulls vehicle data from three dealership websites and detects special badges like "One Owner", "No Accidents", "Certified Pre-Owned", etc.

## Dealerships Configured

1. **Olympic Hyundai Vancouver** - Vancouver
2. **Boundary Hyundai Vancouver** - Burnaby  
3. **Kia Vancouver** - Vancouver

## Smart Badge Detection

The scraper automatically detects these badges from vehicle descriptions:

- **One Owner** - Detects: "one owner", "1 owner", "single owner"
- **No Accidents** - Detects: "no accidents", "accident free", "clean history"
- **Clean Title** - Detects: "clean title", "clear title"
- **Certified Pre-Owned** - Detects: "certified", "cpo", "certified pre-owned"
- **Low Kilometers** - Detects: "low km", "low kilometers", "low mileage"

## Scheduled Sync

The scraper runs automatically every 24 hours at **2:00 AM** to keep inventory fresh.

## Manual Sync

To trigger a manual sync, make a POST request to:

```bash
POST /api/scraper/sync
```

Or use the "Live Updates" button in the inventory interface.

## Testing Badge Detection

To test the badge detection system:

```bash
GET /api/scraper/test-badges
```

This will log test cases to the console showing which badges are detected.

## Customizing for Live Dealerships

The scraper currently contains placeholder logic. To connect to actual dealership websites:

1. Open `server/scraper.ts`
2. Update the URLs in the `DEALERSHIPS` object to actual inventory pages
3. Inspect each dealership's HTML structure
4. Update the scraper selectors in the `scrapeDealership` function to match each site

Example for a real site:

```typescript
// After inspecting the HTML, customize the selectors:
$('.vehicle-listing').each((i, elem) => {
  const year = parseInt($(elem).find('.vehicle-year').text());
  const make = $(elem).find('.vehicle-make').text();
  const model = $(elem).find('.vehicle-model').text();
  const price = parseInt($(elem).find('.price').text().replace(/[^0-9]/g, ''));
  // ... etc
});
```

## How It Works

1. **Fetches HTML** from each dealership's inventory page
2. **Parses** the HTML using Cheerio (jQuery-like selectors)
3. **Extracts** vehicle details (year, make, model, price, odometer, images, descriptions)
4. **Detects badges** by scanning descriptions for keywords
5. **Determines body type** (SUV, Sedan, Truck) from model name and description
6. **Clears** existing inventory in database
7. **Inserts** newly scraped vehicles

## Database Impact

When the scraper runs, it:
- **Deletes** all existing vehicles
- **Inserts** freshly scraped vehicles
- **Preserves** view tracking and Facebook page connections

## Error Handling

If a dealership scrape fails, the error is logged but other dealerships continue to be scraped.
