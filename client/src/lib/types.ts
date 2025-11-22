export interface Car {
  id: number;
  year: number;
  make: string;
  model: string;
  trim: string;
  type: string;
  price: number;
  odometer: number;
  image: string;
  badges: string[];
  views?: number;
  location: string;
  dealership: string;
  description: string;
}

export interface FilterState {
  type: string;
  priceMax: number;
  location: string;
  dealership: string;
  search: string;
}

export const FINANCE_TERMS = [36, 48, 60, 72, 84] as const;
export type FinanceTerm = typeof FINANCE_TERMS[number];

export function calculateMonthlyPayment(price: number, termMonths: FinanceTerm, downPayment: number = 0, apr: number = 6.99): number {
  const principal = price - downPayment;
  const monthlyRate = apr / 100 / 12;
  const payment = (principal * monthlyRate * Math.pow(1 + monthlyRate, termMonths)) / 
                  (Math.pow(1 + monthlyRate, termMonths) - 1);
  return Math.floor(payment);
}
