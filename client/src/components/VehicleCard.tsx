import { useState } from "react";
import { Car, FINANCE_TERMS, calculateMonthlyPayment, type FinanceTerm } from "@/lib/types";
import { MapPin, Flame, Info, ChevronLeft, ChevronRight } from "lucide-react";
import { Link, useLocation } from "wouter";
import { usePayment } from "@/contexts/PaymentContext";

interface VehicleCardProps {
  car: Car;
}

export function VehicleCard({ car }: VehicleCardProps) {
  const { downPayment, apr } = usePayment();
  const [, setLocation] = useLocation();
  const [selectedTerm, setSelectedTerm] = useState<FinanceTerm>(84);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const monthlyPayment = calculateMonthlyPayment(car.price, selectedTerm, downPayment, apr);
  
  const nextImage = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev + 1) % car.images.length);
  };
  
  const prevImage = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev - 1 + car.images.length) % car.images.length);
  };

  return (
    <Link href={`/vehicle/${car.id}`}>
      <div className="group bg-card rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border border-slate-100 cursor-pointer h-full flex flex-col">
        {/* Image Container with Carousel */}
        <div className="relative aspect-[4/3] overflow-hidden">
          <img 
            src={car.images[currentImageIndex] || '/placeholder-car.jpg'} 
            alt={`${car.year} ${car.make} ${car.model}`}
            className="w-full h-full object-cover transition-all duration-300"
            data-testid={`img-vehicle-${car.id}`}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-80"></div>
          
          {/* Image Navigation Arrows - only show if multiple images */}
          {car.images.length > 1 && (
            <>
              <button
                onClick={prevImage}
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white p-1.5 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                data-testid={`button-prev-image-${car.id}`}
              >
                <ChevronLeft className="w-4 h-4 text-slate-700" />
              </button>
              <button
                onClick={nextImage}
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white p-1.5 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                data-testid={`button-next-image-${car.id}`}
              >
                <ChevronRight className="w-4 h-4 text-slate-700" />
              </button>
              
              {/* Image Indicators */}
              <div className="absolute bottom-16 left-1/2 -translate-x-1/2 flex gap-1">
                {car.images.map((_, idx) => (
                  <div
                    key={idx}
                    className={`w-1.5 h-1.5 rounded-full transition-all ${
                      idx === currentImageIndex ? 'bg-white w-4' : 'bg-white/50'
                    }`}
                  />
                ))}
              </div>
            </>
          )}
          
          {/* Location Badge - Top Left */}
          <div className="absolute top-3 left-3">
            <span className="bg-primary text-white text-[10px] font-bold px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {car.dealership}
            </span>
          </div>

          {/* Feature Badges - Top Right */}
          <div className="absolute top-3 right-3 flex flex-wrap gap-1 justify-end max-w-[60%]">
            {car.dealRating && (
              <span className="bg-green-500 text-white text-[10px] font-bold px-2 py-1 rounded shadow-lg">
                {car.dealRating}
              </span>
            )}
            {car.badges.map((badge, i) => (
              <span key={i} className="bg-white/90 backdrop-blur-sm text-[10px] font-bold px-2 py-1 rounded text-primary shadow-sm flex items-center gap-1">
                <Flame className="w-3 h-3 text-orange-500" />
                {badge}
              </span>
            ))}
          </div>

          {/* Price Overlay */}
          <div className="absolute bottom-0 w-full p-4 text-white">
            <div className="flex justify-between items-end mb-2">
              <div>
                <p className="text-2xl font-black">${monthlyPayment}<span className="text-xs font-normal opacity-70">/mo</span></p>
                <p className="text-xs font-bold text-secondary">{selectedTerm} months @ {apr}% APR</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold">${car.price.toLocaleString()}</p>
                <p className="text-[10px] opacity-70">Cash Price</p>
              </div>
            </div>
            
            {/* Term Selector */}
            <div className="flex gap-1" onClick={(e) => e.preventDefault()}>
              {FINANCE_TERMS.map(term => (
                <button
                  key={term}
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setSelectedTerm(term); }}
                  className={`flex-1 py-1 rounded text-[10px] font-bold transition ${
                    selectedTerm === term 
                      ? 'bg-secondary text-white' 
                      : 'bg-white/20 text-white/70 hover:bg-white/30'
                  }`}
                >
                  {term}mo
                </button>
              ))}
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
              <Info className="w-3 h-3" />
              {car.odometer.toLocaleString()} km
            </div>
            {car.views !== undefined && car.views > 0 && (
              <div className="flex items-center gap-1 text-orange-500">
                <Flame className="w-3 h-3" />
                {car.views} views (24h)
              </div>
            )}
          </div>
          
          {/* Dual CTA Buttons */}
          <div className="grid grid-cols-2 gap-2 mt-4">
            <button 
              onClick={(e) => { 
                e.preventDefault(); 
                e.stopPropagation(); 
                setLocation(`/vehicle/${car.id}?action=test-drive`);
              }}
              className="bg-primary text-white py-2 rounded-lg text-xs font-bold hover:bg-blue-900 transition"
              data-testid={`button-test-drive-${car.id}`}
            >
              Book Test Drive
            </button>
            <button 
              onClick={(e) => { 
                e.preventDefault(); 
                e.stopPropagation(); 
                setLocation(`/vehicle/${car.id}?action=reserve`);
              }}
              className="bg-secondary text-white py-2 rounded-lg text-xs font-bold hover:bg-cyan-600 transition"
              data-testid={`button-reserve-${car.id}`}
            >
              Reserve Vehicle
            </button>
          </div>
        </div>
      </div>
    </Link>
  );
}
