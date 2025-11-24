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
}

export async function decodeVIN(vin: string): Promise<VINDecodeResult> {
  try {
    const cleanVIN = vin.trim().toUpperCase();
    
    if (cleanVIN.length !== 17) {
      return {
        vin: cleanVIN,
        errorCode: 'INVALID_VIN_LENGTH',
        errorMessage: 'VIN must be exactly 17 characters'
      };
    }
    
    const url = `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${cleanVIN}?format=json`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`NHTSA API error: ${response.statusText}`);
    }
    
    const data = await response.json();
    const result = data.Results[0];
    
    if (result.ErrorCode !== "0") {
      return {
        vin: cleanVIN,
        errorCode: result.ErrorCode,
        errorMessage: result.ErrorText || 'Unable to decode VIN'
      };
    }
    
    return {
      vin: cleanVIN,
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
    };
  } catch (error) {
    console.error('VIN decode error:', error);
    return {
      vin,
      errorCode: 'DECODE_ERROR',
      errorMessage: error instanceof Error ? error.message : 'Failed to decode VIN'
    };
  }
}
