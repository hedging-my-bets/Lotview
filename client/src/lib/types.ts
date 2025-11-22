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
  views: number;
  location: string;
  description: string;
}

export interface FilterState {
  type: string;
  priceMax: number;
  location: string;
  search: string;
}
