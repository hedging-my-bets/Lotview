import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { vehicles } from "@shared/schema";

const MOCK_VEHICLES = [
  { 
    year: 2024, 
    make: "Hyundai", 
    model: "Tucson", 
    trim: "Preferred AWD", 
    type: "SUV", 
    price: 34999, 
    odometer: 12500, 
    image: "https://images.unsplash.com/photo-1609521263047-f8f205293f24?q=80&w=800", 
    badges: ["One Owner"], 
    location: "Vancouver",
    description: "Experience the perfect blend of style and performance with this 2024 Hyundai Tucson. Featuring advanced safety features and a spacious interior, it's ready for your next adventure."
  },
  { 
    year: 2023, 
    make: "Genesis", 
    model: "GV70", 
    trim: "3.5T Sport", 
    type: "SUV", 
    price: 58500, 
    odometer: 24100, 
    image: "https://images.unsplash.com/photo-1619767886558-efdc259cde1a?q=80&w=800", 
    badges: ["Manager Special"], 
    location: "Burnaby",
    description: "Luxury meets performance in the Genesis GV70. This 3.5T Sport model offers thrilling dynamics and a premium cabin that stands out from the crowd."
  },
  { 
    year: 2024, 
    make: "Ford", 
    model: "F-150", 
    trim: "Lariat", 
    type: "Truck", 
    price: 68900, 
    odometer: 5000, 
    image: "https://images.unsplash.com/photo-1589640031222-48c675f961db?q=80&w=800", 
    badges: ["Clean CarFax"], 
    location: "Richmond",
    description: "Built Ford Tough. The F-150 Lariat combines work-ready capability with high-end comfort features. Low kilometers and ready for duty."
  },
  { 
    year: 2021, 
    make: "Hyundai", 
    model: "Elantra", 
    trim: "N Line", 
    type: "Sedan", 
    price: 26900, 
    odometer: 45000, 
    image: "https://images.unsplash.com/photo-1605559424843-9e4c2287d38d?q=80&w=800", 
    badges: ["Gas Saver"], 
    location: "Vancouver",
    description: "Sporty and efficient. The Elantra N Line delivers a spirited drive without breaking the bank at the pump. Perfect for city commuting."
  },
  { 
    year: 2025, 
    make: "Hyundai", 
    model: "Santa Fe", 
    trim: "Calligraphy", 
    type: "SUV", 
    price: 52000, 
    odometer: 100, 
    image: "https://images.unsplash.com/photo-1592853625601-bb9d23da126e?q=80&w=800", 
    badges: ["New Arrival"], 
    location: "Burnaby",
    description: "Brand new 2025 Santa Fe Calligraphy. The ultimate family SUV with bold styling, premium materials, and the latest technology."
  },
  { 
    year: 2022, 
    make: "Toyota", 
    model: "RAV4", 
    trim: "XLE Premium", 
    type: "SUV", 
    price: 38500, 
    odometer: 32000, 
    image: "https://images.unsplash.com/photo-1621007947382-bb3c3968e3bb?q=80&w=800", 
    badges: ["Reliable"], 
    location: "Richmond",
    description: "The ever-popular RAV4. Reliable, practical, and holds its value like no other. This XLE Premium comes loaded with features."
  },
  { 
    year: 2023, 
    make: "Honda", 
    model: "Civic", 
    trim: "Touring", 
    type: "Sedan", 
    price: 31200, 
    odometer: 15000, 
    image: "https://images.unsplash.com/photo-1605515298946-d061f5b9a64f?q=80&w=800", 
    badges: ["Fuel Efficient"], 
    location: "Vancouver",
    description: "Refined and fun to drive. The Civic Touring sets the benchmark for compact sedans with its upscale interior and smooth ride."
  },
  { 
    year: 2024, 
    make: "BMW", 
    model: "X5", 
    trim: "xDrive40i", 
    type: "SUV", 
    price: 89900, 
    odometer: 8500, 
    image: "https://images.unsplash.com/photo-1556189250-72ba95452da9?q=80&w=800", 
    badges: ["Luxury"], 
    location: "Burnaby",
    description: "The boss is back. The X5 delivers commanding performance and uncompromising luxury. A true statement vehicle."
  }
];

async function seed() {
  const connectionString = process.env.DATABASE_URL!;
  const queryClient = neon(connectionString);
  const db = drizzle(queryClient);

  console.log("Seeding database with inventory...");
  
  for (const vehicle of MOCK_VEHICLES) {
    await db.insert(vehicles).values(vehicle);
  }

  console.log(`✓ Seeded ${MOCK_VEHICLES.length} vehicles`);
}

seed().catch(console.error);
