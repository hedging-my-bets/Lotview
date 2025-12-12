import { storage } from './storage';

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
  errorCode?: string;
  errorMessage?: string;
  source?: 'marketcheck' | 'nhtsa';
}

async function decodeVINWithMarketCheck(vin: string, apiKey: string): Promise<VINDecodeResult | null> {
  try {
    const url = `https://api.marketcheck.com/v2/decode/car/${vin}/specs?api_key=${apiKey}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.log(`[VIN Decoder] MarketCheck returned ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    
    if (!data || data.error || data.is_valid === false) {
      console.log('[VIN Decoder] MarketCheck returned error or invalid VIN:', data?.error || 'VIN not valid');
      return null;
    }
    
    return {
      vin,
      year: data.year?.toString() || undefined,
      make: data.make || undefined,
      model: data.model || undefined,
      trim: data.trim || undefined,
      bodyClass: data.body_type || undefined,
      engineCylinders: data.cylinders?.toString() || undefined,
      engineHP: undefined,
      fuelType: data.fuel_type || undefined,
      driveType: data.drivetrain || undefined,
      transmission: data.transmission || undefined,
      doors: data.doors?.toString() || undefined,
      manufacturer: undefined,
      plantCountry: data.made_in || undefined,
      vehicleType: data.vehicle_type || undefined,
      source: 'marketcheck'
    };
  } catch (error) {
    console.log('[VIN Decoder] MarketCheck error:', error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

async function decodeVINWithNHTSA(vin: string): Promise<VINDecodeResult> {
  try {
    const url = `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${vin}?format=json`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`NHTSA API error: ${response.statusText}`);
    }
    
    const data = await response.json();
    const result = data.Results[0];
    
    if (result.ErrorCode !== "0") {
      return {
        vin,
        errorCode: result.ErrorCode,
        errorMessage: result.ErrorText || 'Unable to decode VIN',
        source: 'nhtsa'
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
      source: 'nhtsa'
    };
  } catch (error) {
    console.error('[VIN Decoder] NHTSA error:', error);
    
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        vin,
        errorCode: 'TIMEOUT',
        errorMessage: 'VIN decode request timed out. Please try again.',
        source: 'nhtsa'
      };
    }
    
    return {
      vin,
      errorCode: 'DECODE_ERROR',
      errorMessage: error instanceof Error ? error.message : 'Failed to decode VIN',
      source: 'nhtsa'
    };
  }
}

export async function decodeVIN(vin: string, dealershipId?: number): Promise<VINDecodeResult> {
  const cleanVIN = vin.trim().toUpperCase();
  
  if (cleanVIN.length !== 17) {
    return {
      vin: cleanVIN,
      errorCode: 'INVALID_VIN_LENGTH',
      errorMessage: 'VIN must be exactly 17 characters'
    };
  }
  
  // Try MarketCheck first (faster, more reliable)
  const effectiveDealershipId = dealershipId || 1;
  try {
    const apiKeys = await storage.getDealershipApiKeys(effectiveDealershipId);
    
    if (apiKeys?.marketcheckKey) {
      console.log(`[VIN Decoder] Trying MarketCheck for ${cleanVIN}`);
      const marketCheckResult = await decodeVINWithMarketCheck(cleanVIN, apiKeys.marketcheckKey);
      
      if (marketCheckResult && !marketCheckResult.errorCode) {
        console.log('[VIN Decoder] MarketCheck success');
        return marketCheckResult;
      }
    } else {
      console.log('[VIN Decoder] No MarketCheck API key configured, using NHTSA');
    }
  } catch (error) {
    console.log('[VIN Decoder] Error fetching MarketCheck key:', error);
  }
  
  // Fallback to NHTSA
  console.log(`[VIN Decoder] Falling back to NHTSA for ${cleanVIN}`);
  return decodeVINWithNHTSA(cleanVIN);
}
