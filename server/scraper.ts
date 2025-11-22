import * as cheerio from 'cheerio';
import { db } from './storage';
import { vehicles } from '@shared/schema';
import { sql } from 'drizzle-orm';

interface ScrapedVehicle {
  year: number;
  make: string;
  model: string;
  trim: string;
  type: string;
  price: number;
  odometer: number;
  image: string;
  badges: string[];
  location: string;
  dealership: string;
  description: string;
}

const DEALERSHIPS = {
  olympicHyundai: {
    name: 'Olympic Hyundai Vancouver',
    location: 'Vancouver',
    url: 'https://www.olympichyundai.com/inventory',
  },
  boundaryHyundai: {
    name: 'Boundary Hyundai Vancouver',
    location: 'Burnaby',
    url: 'https://www.boundaryhyundai.com/inventory',
  },
  kiaVancouver: {
    name: 'Kia Vancouver',
    location: 'Vancouver',
    url: 'https://www.kiavancouver.com/inventory',
  }
};

const BADGE_KEYWORDS = {
  oneOwner: ['one owner', '1 owner', 'single owner'],
  noAccidents: ['no accidents', 'accident free', 'clean history', 'accident-free'],
  cleanTitle: ['clean title', 'clear title'],
  certifiedPreOwned: ['certified', 'cpo', 'certified pre-owned'],
  lowKm: ['low km', 'low kilometers', 'low mileage'],
};

function detectBadges(text: string): string[] {
  const badges: string[] = [];
  const lowerText = text.toLowerCase();

  if (BADGE_KEYWORDS.oneOwner.some(keyword => lowerText.includes(keyword))) {
    badges.push('One Owner');
  }
  if (BADGE_KEYWORDS.noAccidents.some(keyword => lowerText.includes(keyword))) {
    badges.push('No Accidents');
  }
  if (BADGE_KEYWORDS.cleanTitle.some(keyword => lowerText.includes(keyword))) {
    badges.push('Clean Title');
  }
  if (BADGE_KEYWORDS.certifiedPreOwned.some(keyword => lowerText.includes(keyword))) {
    badges.push('Certified Pre-Owned');
  }
  if (BADGE_KEYWORDS.lowKm.some(keyword => lowerText.includes(keyword))) {
    badges.push('Low Kilometers');
  }

  return badges;
}

async function fetchHTML(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    return await response.text();
  } catch (error) {
    console.error(`Failed to fetch ${url}:`, error);
    throw error;
  }
}

function determineBodyType(modelName: string, description: string): string {
  const lowerModel = modelName.toLowerCase();
  const lowerDesc = description.toLowerCase();
  const combined = lowerModel + ' ' + lowerDesc;

  if (combined.includes('truck') || combined.includes('f-150') || combined.includes('silverado')) {
    return 'Truck';
  }
  if (combined.includes('sedan') || combined.includes('elantra') || combined.includes('accord') || combined.includes('civic')) {
    return 'Sedan';
  }
  if (combined.includes('coupe')) {
    return 'Coupe';
  }
  if (combined.includes('hatchback')) {
    return 'Hatchback';
  }
  return 'SUV'; // Default to SUV for most models
}

async function scrapeDealership(dealershipKey: string): Promise<ScrapedVehicle[]> {
  const dealership = DEALERSHIPS[dealershipKey as keyof typeof DEALERSHIPS];
  console.log(`Scraping ${dealership.name}...`);

  try {
    const html = await fetchHTML(dealership.url);
    const $ = cheerio.load(html);
    const scrapedVehicles: ScrapedVehicle[] = [];

    // This is a generic scraper - in production, you'd need to customize selectors per site
    // For now, we'll return empty array as we need the actual site structure
    console.log(`Would scrape from ${dealership.url}`);
    console.log(`Note: This requires site-specific selectors based on actual dealership websites`);

    // Example structure (would need to be customized):
    // $('.vehicle-card').each((i, elem) => {
    //   const year = parseInt($(elem).find('.year').text());
    //   const make = $(elem).find('.make').text();
    //   const model = $(elem).find('.model').text();
    //   const trim = $(elem).find('.trim').text();
    //   const price = parseInt($(elem).find('.price').text().replace(/[^0-9]/g, ''));
    //   const odometer = parseInt($(elem).find('.odometer').text().replace(/[^0-9]/g, ''));
    //   const image = $(elem).find('img').attr('src') || '';
    //   const description = $(elem).find('.description').text();
    //   const badges = detectBadges(description);
    //   const type = determineBodyType(model, description);
    //
    //   scrapedVehicles.push({
    //     year, make, model, trim, type, price, odometer, image,
    //     badges, location: dealership.location, dealership: dealership.name, description
    //   });
    // });

    return scrapedVehicles;
  } catch (error) {
    console.error(`Error scraping ${dealership.name}:`, error);
    return [];
  }
}

export async function scrapeAllDealerships(): Promise<number> {
  console.log('Starting dealership inventory scrape...');
  
  const allVehicles: ScrapedVehicle[] = [];
  
  for (const key of Object.keys(DEALERSHIPS)) {
    const vehicles = await scrapeDealership(key);
    allVehicles.push(...vehicles);
  }

  if (allVehicles.length > 0) {
    // Clear existing inventory
    await db.delete(vehicles);
    
    // Insert new inventory
    await db.insert(vehicles).values(allVehicles);
    
    console.log(`✓ Scraped and saved ${allVehicles.length} vehicles`);
  } else {
    console.log('⚠ No vehicles scraped - scraper needs site-specific configuration');
  }

  return allVehicles.length;
}

export async function testBadgeDetection() {
  const testDescriptions = [
    "One owner vehicle with clean history. No accidents reported.",
    "Certified pre-owned with low kilometers. Accident free!",
    "Clean title, single owner, excellent condition",
    "Great price on this used vehicle"
  ];

  console.log('\n=== Badge Detection Test ===');
  testDescriptions.forEach((desc, i) => {
    const badges = detectBadges(desc);
    console.log(`\nTest ${i + 1}: "${desc}"`);
    console.log(`Detected badges: ${badges.join(', ') || 'None'}`);
  });
}
