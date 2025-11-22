// Google Tag Manager tracking utility

declare global {
  interface Window {
    dataLayer: any[];
  }
}

// Initialize dataLayer if it doesn't exist
if (typeof window !== 'undefined') {
  window.dataLayer = window.dataLayer || [];
}

interface VehicleData {
  id: number;
  vin?: string | null;
  make: string;
  model: string;
  year: number;
  price: number;
  dealership: string;
  type: string;
}

interface PaymentContext {
  creditScore: string;
  downPayment: number;
  apr: number;
  term?: number;
}

/**
 * Track vehicle view (detail page)
 */
export function trackVehicleView(vehicle: VehicleData) {
  if (typeof window === 'undefined') return;
  
  window.dataLayer.push({
    event: 'vehicle_viewed',
    vehicle_id: vehicle.id,
    vehicle_vin: vehicle.vin || 'N/A',
    vehicle_make: vehicle.make,
    vehicle_model: vehicle.model,
    vehicle_year: vehicle.year,
    vehicle_price: vehicle.price,
    vehicle_dealership: vehicle.dealership,
    vehicle_type: vehicle.type,
  });
}

/**
 * Track vehicle impression (card visible in inventory)
 */
export function trackVehicleImpression(vehicle: VehicleData, position: number) {
  if (typeof window === 'undefined') return;
  
  window.dataLayer.push({
    event: 'vehicle_impression',
    vehicle_id: vehicle.id,
    vehicle_make: vehicle.make,
    vehicle_model: vehicle.model,
    vehicle_price: vehicle.price,
    list_position: position,
  });
}

/**
 * Track CTA clicks (Test Drive, Reserve, etc.)
 */
export function trackCTAClick(
  ctaType: 'test_drive' | 'reserve' | 'get_approved' | 'value_trade' | 'chat_open',
  vehicle: VehicleData
) {
  if (typeof window === 'undefined') return;
  
  window.dataLayer.push({
    event: 'cta_click',
    cta_type: ctaType,
    vehicle_id: vehicle.id,
    vehicle_vin: vehicle.vin || 'N/A',
    vehicle_make: vehicle.make,
    vehicle_model: vehicle.model,
    vehicle_year: vehicle.year,
    vehicle_price: vehicle.price,
    vehicle_dealership: vehicle.dealership,
    vehicle_type: vehicle.type,
  });
}

/**
 * Track chat message sent
 */
export function trackChatMessage(vehicle?: VehicleData, messageCount?: number) {
  if (typeof window === 'undefined') return;
  
  window.dataLayer.push({
    event: 'chat_message_sent',
    vehicle_id: vehicle?.id,
    vehicle_vin: vehicle?.vin || 'N/A',
    vehicle_make: vehicle?.make,
    vehicle_model: vehicle?.model,
    vehicle_year: vehicle?.year,
    vehicle_price: vehicle?.price,
    vehicle_dealership: vehicle?.dealership,
    vehicle_type: vehicle?.type,
    message_count: messageCount || 1,
  });
}

/**
 * Track chat opened
 */
export function trackChatOpen(vehicle?: VehicleData, triggerType?: 'cta' | 'auto' | 'manual') {
  if (typeof window === 'undefined') return;
  
  window.dataLayer.push({
    event: 'chat_opened',
    vehicle_id: vehicle?.id,
    vehicle_vin: vehicle?.vin || 'N/A',
    vehicle_make: vehicle?.make,
    vehicle_model: vehicle?.model,
    vehicle_year: vehicle?.year,
    vehicle_price: vehicle?.price,
    vehicle_dealership: vehicle?.dealership,
    vehicle_type: vehicle?.type,
    trigger_type: triggerType || 'manual',
  });
}

/**
 * Track payment calculator interaction
 */
export function trackPaymentCalculation(
  vehicle: VehicleData,
  paymentContext: PaymentContext,
  monthlyPayment: number
) {
  if (typeof window === 'undefined') return;
  
  window.dataLayer.push({
    event: 'payment_calculated',
    vehicle_id: vehicle.id,
    vehicle_price: vehicle.price,
    credit_score: paymentContext.creditScore,
    down_payment: paymentContext.downPayment,
    apr: paymentContext.apr,
    term_months: paymentContext.term,
    monthly_payment: monthlyPayment,
  });
}

/**
 * Track filter changes in inventory
 */
export function trackFilterChange(filterType: string, filterValue: string | number) {
  if (typeof window === 'undefined') return;
  
  window.dataLayer.push({
    event: 'filter_changed',
    filter_type: filterType,
    filter_value: filterValue,
  });
}

/**
 * Track page view
 */
export function trackPageView(pageName: string, pageType: string) {
  if (typeof window === 'undefined') return;
  
  window.dataLayer.push({
    event: 'page_view',
    page_name: pageName,
    page_type: pageType,
  });
}
