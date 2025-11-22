import { Car } from "@/lib/types";
import { MapPin, Flame, Info } from "lucide-react";
import { Link } from "wouter";

interface VehicleCardProps {
  car: Car;
}

export function VehicleCard({ car }: VehicleCardProps) {
  // Formula provided: (price * 1.05) / 84 * 1.07
  const monthlyPayment = Math.floor((car.price * 1.05) / 84 * 1.07);

  return (
    <Link href={`/vehicle/${car.id}`}>
      <div className="group bg-card rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border border-slate-100 cursor-pointer h-full flex flex-col">
        {/* Image Container */}
        <div className="relative aspect-[4/3] overflow-hidden">
          <img 
            src={car.image} 
            alt={`${car.year} ${car.make} ${car.model}`}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-80"></div>
          
          {/* Badges */}
          <div className="absolute top-3 left-3 flex flex-wrap gap-1">
            {car.badges.map((badge, i) => (
              <span key={i} className="bg-white/90 backdrop-blur-sm text-[10px] font-bold px-2 py-1 rounded text-primary shadow-sm flex items-center gap-1">
                <Flame className="w-3 h-3 text-orange-500" />
                {badge}
              </span>
            ))}
          </div>

          {/* Price Overlay */}
          <div className="absolute bottom-0 w-full p-4 text-white flex justify-between items-end">
            <div>
              <p className="text-2xl font-black">${monthlyPayment}<span className="text-xs font-normal opacity-70">/mo</span></p>
              <p className="text-xs font-bold text-secondary">Est. Finance</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold">${car.price.toLocaleString()}</p>
              <p className="text-[10px] opacity-70">Cash Price</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 flex-1 flex flex-col">
          <div className="mb-3">
            <h3 className="text-lg font-bold text-slate-900 leading-tight">
              {car.year} {car.make} {car.model}
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-1">{car.trim}</p>
          </div>

          <div className="mt-auto pt-3 border-t border-slate-100 flex justify-between items-center text-xs text-slate-500 font-medium">
            <div className="flex items-center gap-1">
              <MapPin className="w-3 h-3 text-secondary" />
              {car.location}
            </div>
            <div className="flex items-center gap-1">
              <Info className="w-3 h-3" />
              {car.odometer.toLocaleString()} km
            </div>
            <div className="flex items-center gap-1 text-orange-500">
              <Flame className="w-3 h-3" />
              {car.views} views
            </div>
          </div>
          
          <button className="w-full mt-4 bg-primary text-white py-2 rounded-lg text-sm font-bold hover:bg-blue-900 transition">
            Check Availability
          </button>
        </div>
      </div>
    </Link>
  );
}
