export interface TenantContext {
  user?: {
    id?: number;
    dealershipId?: number | null;
  };
  dealershipId?: number;
}

const DEFAULT_DEALERSHIP_ID = 1;

export function resolveDealershipId(req: TenantContext): number {
  if (req.dealershipId && typeof req.dealershipId === 'number') {
    return req.dealershipId;
  }
  
  if (req.user?.dealershipId && typeof req.user.dealershipId === 'number') {
    return req.user.dealershipId;
  }
  
  return DEFAULT_DEALERSHIP_ID;
}

export function resolveDealershipIdStrict(req: TenantContext): number | null {
  if (req.dealershipId && typeof req.dealershipId === 'number') {
    return req.dealershipId;
  }
  
  if (req.user?.dealershipId && typeof req.user.dealershipId === 'number') {
    return req.user.dealershipId;
  }
  
  return null;
}

export function getDealershipIdFromParams(
  params: { dealershipId?: number | string | null },
  fallbackToDefault: boolean = true
): number | null {
  if (params.dealershipId !== undefined && params.dealershipId !== null) {
    const id = typeof params.dealershipId === 'string' 
      ? parseInt(params.dealershipId, 10) 
      : params.dealershipId;
    
    if (!isNaN(id) && id > 0) {
      return id;
    }
  }
  
  return fallbackToDefault ? DEFAULT_DEALERSHIP_ID : null;
}

export function isValidDealershipId(id: unknown): id is number {
  return typeof id === 'number' && !isNaN(id) && id > 0;
}

export const SINGLE_DEALERSHIP_MODE = true;
