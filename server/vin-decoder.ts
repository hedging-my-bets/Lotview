import { storage } from './storage';
import puppeteer from 'puppeteer';

export interface VINDecodeResult {
  vin: string;
  year?: string;
  make?: string;
  model?: string;
  trim?: string;
  bodyClass?: string;
  engineCylinders?: string;
  engineHP?: string;
  fuelType?: string;
  driveType?: string;
  transmission?: string;
  doors?: string;
  manufacturer?: string;
  plantCountry?: string;
  vehicleType?: string;
  interiorColor?: string;
  exteriorColor?: string;
  errorCode?: string;
  errorMessage?: string;
  source?: 'marketcheck' | 'api_ninjas' | 'nhtsa' | 'cargurus';
  responseTimeMs?: number;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function decodeVINWithMarketCheck(vin: string, apiKey: string): Promise<VINDecodeResult | null> {
  const startTime = Date.now();
  
  try {
    const url = `https://api.marketcheck.com/v2/decode/car/${vin}/specs?api_key=${apiKey}`;
    
    console.log(`[VIN Decoder] Trying MarketCheck for ${vin}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json'
      }
    });
    clearTimeout(timeoutId);
    
    const responseTime = Date.now() - startTime;
    console.log(`[VIN Decoder] MarketCheck responded in ${responseTime}ms with status ${response.status}`);
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.log(`[VIN Decoder] MarketCheck error: ${response.status} - ${errorText}`);
      return null;
    }
    
    const data = await response.json();
    
    if (!data || data.error) {
      console.log('[VIN Decoder] MarketCheck returned error:', data?.error);
      return null;
    }
    
    return {
      vin,
      year: data.year?.toString() || undefined,
      make: data.make || undefined,
      model: data.model || undefined,
      trim: data.trim || undefined,
      bodyClass: data.body_type || data.body_style || undefined,
      engineCylinders: data.cylinders?.toString() || undefined,
      engineHP: data.horsepower?.toString() || undefined,
      fuelType: data.fuel_type || undefined,
      driveType: data.drivetrain || undefined,
      transmission: data.transmission || undefined,
      doors: data.doors?.toString() || undefined,
      manufacturer: data.manufacturer || undefined,
      vehicleType: data.vehicle_type || undefined,
      source: 'marketcheck',
      responseTimeMs: responseTime
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    const isTimeout = error instanceof Error && error.name === 'AbortError';
    console.log(`[VIN Decoder] MarketCheck error (${responseTime}ms):`, isTimeout ? 'TIMEOUT' : (error instanceof Error ? error.message : 'Unknown error'));
    return null;
  }
}

async function decodeVINWithApiNinjas(vin: string, apiKey: string): Promise<VINDecodeResult | null> {
  const startTime = Date.now();
  
  try {
    const url = `https://api.api-ninjas.com/v1/vinlookup?vin=${vin}`;
    
    console.log(`[VIN Decoder] Trying API Ninjas for ${vin}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'X-Api-Key': apiKey,
        'Accept': 'application/json'
      }
    });
    clearTimeout(timeoutId);
    
    const responseTime = Date.now() - startTime;
    console.log(`[VIN Decoder] API Ninjas responded in ${responseTime}ms with status ${response.status}`);
    
    if (!response.ok) {
      console.log(`[VIN Decoder] API Ninjas returned ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    
    if (!data || data.error) {
      console.log('[VIN Decoder] API Ninjas returned error:', data?.error);
      return null;
    }
    
    return {
      vin,
      year: data.model_year?.toString() || undefined,
      make: data.make || undefined,
      model: data.model || undefined,
      trim: data.trim || undefined,
      bodyClass: data.body_class || undefined,
      manufacturer: data.manufacturer || undefined,
      plantCountry: data.plant_country || undefined,
      vehicleType: data.vehicle_type || undefined,
      source: 'api_ninjas',
      responseTimeMs: responseTime
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.log(`[VIN Decoder] API Ninjas error (${responseTime}ms):`, error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

async function decodeVINWithNHTSA(vin: string, attempt: number = 1): Promise<VINDecodeResult> {
  const maxAttempts = 3;
  const baseTimeout = 30000;
  const startTime = Date.now();
  
  try {
    const url = `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${vin}?format=json`;
    
    console.log(`[VIN Decoder] NHTSA attempt ${attempt}/${maxAttempts} for ${vin}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), baseTimeout);
    
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    const responseTime = Date.now() - startTime;
    console.log(`[VIN Decoder] NHTSA responded in ${responseTime}ms`);
    
    if (!response.ok) {
      throw new Error(`NHTSA API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    const result = data.Results?.[0];
    
    if (!result) {
      throw new Error('NHTSA returned empty results');
    }
    
    if (result.ErrorCode && result.ErrorCode !== "0") {
      return {
        vin,
        errorCode: result.ErrorCode,
        errorMessage: result.ErrorText || 'Unable to decode VIN',
        source: 'nhtsa',
        responseTimeMs: responseTime
      };
    }
    
    return {
      vin,
      year: result.ModelYear || undefined,
      make: result.Make || undefined,
      model: result.Model || undefined,
      trim: result.Trim || undefined,
      bodyClass: result.BodyClass || undefined,
      engineCylinders: result.EngineCylinders || undefined,
      engineHP: result.EngineHP || undefined,
      fuelType: result.FuelTypePrimary || undefined,
      driveType: result.DriveType || undefined,
      transmission: result.TransmissionStyle || undefined,
      doors: result.Doors || undefined,
      manufacturer: result.Manufacturer || undefined,
      plantCountry: result.PlantCountry || undefined,
      vehicleType: result.VehicleType || undefined,
      source: 'nhtsa',
      responseTimeMs: responseTime
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    const isTimeout = error instanceof Error && error.name === 'AbortError';
    
    console.log(`[VIN Decoder] NHTSA attempt ${attempt} failed: ${isTimeout ? 'TIMEOUT' : (error instanceof Error ? error.message : 'Unknown error')}`);
    
    if (attempt < maxAttempts) {
      const backoffMs = Math.pow(2, attempt) * 1000;
      console.log(`[VIN Decoder] Retrying in ${backoffMs}ms...`);
      await sleep(backoffMs);
      return decodeVINWithNHTSA(vin, attempt + 1);
    }
    
    return {
      vin,
      errorCode: isTimeout ? 'TIMEOUT' : 'DECODE_ERROR',
      errorMessage: isTimeout 
        ? `NHTSA timed out after ${maxAttempts} attempts. The service may be slow.`
        : (error instanceof Error ? error.message : 'Failed to decode VIN'),
      source: 'nhtsa',
      responseTimeMs: responseTime
    };
  }
}

interface CarGurusColorResult {
  interiorColor?: string;
  exteriorColor?: string;
  found: boolean;
}

async function lookupCarGurusColors(vin: string): Promise<CarGurusColorResult> {
  const startTime = Date.now();
  let browser = null;
  
  try {
    console.log(`[VIN Decoder] Looking up colors from CarGurus for ${vin}`);
    
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--single-process'
      ]
    });
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Search CarGurus Canada for the VIN
    const searchUrl = `https://www.cargurus.ca/Cars/inventorylisting/viewDetailsFilterViewInventoryListing.action?zip=V6H&showNegotiable=true&sortDir=ASC&sourceContext=carGurusHomePageModel&distance=50000&sortType=DEAL_SCORE&vin=${vin}`;
    
    await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 20000 });
    await sleep(2000);
    
    // Try to find and click the first listing result
    const listingLink = await page.$('a[href*="/Cars/link/"]');
    
    if (!listingLink) {
      console.log(`[VIN Decoder] No CarGurus listing found for VIN ${vin}`);
      return { found: false };
    }
    
    // Get the listing URL and navigate to it
    const href = await listingLink.evaluate((el: Element) => (el as HTMLAnchorElement).href);
    await page.goto(href, { waitUntil: 'networkidle2', timeout: 20000 });
    await sleep(2000);
    
    // Extract colors from the page
    const colors = await page.evaluate(() => {
      const result: { interiorColor?: string; exteriorColor?: string } = {};
      
      // Try to find __NEXT_DATA__ for structured data
      try {
        const nextDataScript = document.querySelector('script#__NEXT_DATA__');
        if (nextDataScript && nextDataScript.textContent) {
          const nextData = JSON.parse(nextDataScript.textContent);
          const listing = nextData?.props?.pageProps?.listing || 
                          nextData?.props?.pageProps?.listingDetail;
          
          if (listing) {
            result.interiorColor = listing.interiorColor || listing.interior_color || undefined;
            result.exteriorColor = listing.exteriorColor || listing.exterior_color || listing.color || undefined;
            
            if (result.interiorColor || result.exteriorColor) {
              return result;
            }
          }
        }
      } catch (e) {
        // JSON parse failed, try DOM extraction
      }
      
      // DOM fallback - look for color labels
      const allText = document.body.innerText;
      
      // Look for "Interior Color: <color>" pattern
      const interiorMatch = allText.match(/Interior\s*(?:Color|Colour)?[:\s]+([A-Za-z\s]+?)(?:\n|Exterior|$)/i);
      if (interiorMatch) {
        result.interiorColor = interiorMatch[1].trim();
      }
      
      // Look for "Exterior Color: <color>" pattern
      const exteriorMatch = allText.match(/Exterior\s*(?:Color|Colour)?[:\s]+([A-Za-z\s]+?)(?:\n|Interior|$)/i);
      if (exteriorMatch) {
        result.exteriorColor = exteriorMatch[1].trim();
      }
      
      // Alternative: look for color in specs table
      const specRows = document.querySelectorAll('tr, [class*="spec"], [class*="detail"]');
      specRows.forEach((row) => {
        const text = row.textContent?.toLowerCase() || '';
        if (text.includes('interior') && text.includes('color')) {
          const colorMatch = row.textContent?.match(/(?:color|colour)[:\s]+(.+)/i);
          if (colorMatch && !result.interiorColor) {
            result.interiorColor = colorMatch[1].trim();
          }
        }
        if (text.includes('exterior') && text.includes('color')) {
          const colorMatch = row.textContent?.match(/(?:color|colour)[:\s]+(.+)/i);
          if (colorMatch && !result.exteriorColor) {
            result.exteriorColor = colorMatch[1].trim();
          }
        }
      });
      
      return result;
    });
    
    const responseTime = Date.now() - startTime;
    console.log(`[VIN Decoder] CarGurus color lookup completed in ${responseTime}ms - Interior: ${colors.interiorColor || 'N/A'}, Exterior: ${colors.exteriorColor || 'N/A'}`);
    
    return {
      interiorColor: colors.interiorColor,
      exteriorColor: colors.exteriorColor,
      found: !!(colors.interiorColor || colors.exteriorColor)
    };
    
  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.log(`[VIN Decoder] CarGurus color lookup failed after ${responseTime}ms:`, error instanceof Error ? error.message : 'Unknown error');
    return { found: false };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

export async function decodeVIN(vin: string, dealershipId?: number): Promise<VINDecodeResult> {
  const cleanVIN = vin.trim().toUpperCase();
  const startTime = Date.now();
  
  if (cleanVIN.length !== 17) {
    return {
      vin: cleanVIN,
      errorCode: 'INVALID_VIN_LENGTH',
      errorMessage: 'VIN must be exactly 17 characters'
    };
  }
  
  console.log(`[VIN Decoder] Starting decode for ${cleanVIN}`);
  
  const effectiveDealershipId = dealershipId || 1;
  let marketCheckApiKey: string | null = null;
  
  try {
    const apiKeys = await storage.getDealershipApiKeys(effectiveDealershipId);
    marketCheckApiKey = apiKeys?.marketcheckKey || null;
  } catch (error) {
    console.log('[VIN Decoder] Error fetching API keys:', error);
  }
  
  const apiNinjasKey = process.env.API_NINJAS_KEY || null;
  
  let decodeResult: VINDecodeResult | null = null;
  
  // Priority 1: MarketCheck (fastest, most reliable when available)
  if (marketCheckApiKey) {
    const marketCheckResult = await decodeVINWithMarketCheck(cleanVIN, marketCheckApiKey);
    
    if (marketCheckResult && !marketCheckResult.errorCode) {
      console.log(`[VIN Decoder] Success with MarketCheck in ${marketCheckResult.responseTimeMs}ms`);
      decodeResult = marketCheckResult;
    } else {
      console.log('[VIN Decoder] MarketCheck failed, trying next fallback');
    }
  } else {
    console.log('[VIN Decoder] No MarketCheck API key configured');
  }
  
  // Priority 2: NHTSA (free government service, comprehensive data)
  if (!decodeResult) {
    console.log('[VIN Decoder] Trying NHTSA');
    const nhtsaResult = await decodeVINWithNHTSA(cleanVIN);
    
    if (!nhtsaResult.errorCode) {
      console.log(`[VIN Decoder] Success with NHTSA in ${nhtsaResult.responseTimeMs}ms`);
      decodeResult = nhtsaResult;
    } else {
      console.log('[VIN Decoder] NHTSA failed, trying next fallback');
      
      // Priority 3: API Ninjas (last resort - free tier has limited data)
      if (apiNinjasKey) {
        const apiNinjasResult = await decodeVINWithApiNinjas(cleanVIN, apiNinjasKey);
        
        if (apiNinjasResult && !apiNinjasResult.errorCode) {
          // Check if API Ninjas returned actual data (not "premium subscribers" message)
          if (apiNinjasResult.model && !apiNinjasResult.model.toLowerCase().includes('premium')) {
            console.log(`[VIN Decoder] Success with API Ninjas in ${apiNinjasResult.responseTimeMs}ms`);
            decodeResult = apiNinjasResult;
          } else {
            console.log('[VIN Decoder] API Ninjas returned premium-only data, skipping');
          }
        } else {
          console.log('[VIN Decoder] API Ninjas failed');
        }
      } else {
        console.log('[VIN Decoder] No API Ninjas key configured (set API_NINJAS_KEY env var)');
      }
      
      // All decoders failed
      if (!decodeResult) {
        const totalTime = Date.now() - startTime;
        console.log(`[VIN Decoder] All decoders failed after ${totalTime}ms`);
        
        return {
          ...nhtsaResult,
          errorMessage: `VIN decode failed after trying all available services. ${nhtsaResult.errorMessage}`,
          responseTimeMs: totalTime
        };
      }
    }
  }
  
  // Enhancement: Try to get interior/exterior colors from CarGurus
  if (decodeResult && !decodeResult.interiorColor) {
    try {
      console.log('[VIN Decoder] Enhancing with CarGurus color lookup...');
      const colors = await lookupCarGurusColors(cleanVIN);
      
      if (colors.found) {
        decodeResult.interiorColor = colors.interiorColor;
        decodeResult.exteriorColor = colors.exteriorColor;
        console.log(`[VIN Decoder] Added colors from CarGurus - Interior: ${colors.interiorColor || 'N/A'}, Exterior: ${colors.exteriorColor || 'N/A'}`);
      }
    } catch (error) {
      console.log('[VIN Decoder] CarGurus color lookup failed, continuing without colors');
    }
  }
  
  const totalTime = Date.now() - startTime;
  decodeResult.responseTimeMs = totalTime;
  
  return decodeResult;
}
