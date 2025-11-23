import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Navbar } from "@/components/Navbar";
import { ChatBot } from "@/components/ChatBot";
import { getVehicleById, trackVehicleView } from "@/lib/api";
import { FINANCE_TERMS, calculateMonthlyPayment, type FinanceTerm } from "@/lib/types";
import { ArrowLeft, Calendar, CheckCircle2, MapPin, Gauge, Flame, Share2, Heart, ChevronLeft, ChevronRight, DollarSign, Car } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { usePayment } from "@/contexts/PaymentContext";
import { useChat } from "@/contexts/ChatContext";
import { trackVehicleView as trackGTMVehicleView, trackCTAClick, trackPaymentCalculation } from "@/lib/tracking";

export default function VehicleDetail() {
  const [match, params] = useRoute("/vehicle/:id");
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const { downPayment, apr } = usePayment();
  const { openChat } = useChat();
  const [sessionId] = useState(() => `session-${Date.now()}-${Math.random()}`);
  const [selectedTerm, setSelectedTerm] = useState<FinanceTerm>(84);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const vehicleId = Number(params?.id);
  
  // Read action from query parameter - reactive to location changes
  const action = new URLSearchParams(location.split('?')[1]).get('action');

  const { data: car, isLoading } = useQuery({
    queryKey: ["vehicle", vehicleId],
    queryFn: () => getVehicleById(vehicleId),
    enabled: !!vehicleId,
  });

  const trackViewMutation = useMutation({
    mutationFn: () => trackVehicleView(vehicleId, sessionId),
  });

  useEffect(() => {
    if (car) {
      // Track view for remarketing after 2 seconds
      const timer = setTimeout(() => {
        trackViewMutation.mutate();
        trackGTMVehicleView(car); // GTM tracking
        console.log(`Tracked view for vehicle ${car.id} for remarketing.`);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [car]);

  const handleAction = (actionType: string) => {
    if (!car) return;
    
    // Map action text to tracking type and chat message
    const ctaMap: Record<string, { trackingType: string; message: string }> = {
      'Get Pre-Approved': {
        trackingType: 'get_approved',
        message: `I'd like to get pre-approved for financing on the ${car.year} ${car.make} ${car.model}.`
      },
      'Book Test Drive': {
        trackingType: 'test_drive',
        message: `I'd like to book a test drive for the ${car.year} ${car.make} ${car.model}.`
      },
      'Value Your Trade-in': {
        trackingType: 'value_trade',
        message: `I'd like to get a trade-in value for my vehicle toward the ${car.year} ${car.make} ${car.model}.`
      },
      'Reserve Vehicle': {
        trackingType: 'reserve',
        message: `I'd like to reserve the ${car.year} ${car.make} ${car.model}.`
      },
    };
    
    const ctaData = ctaMap[actionType];
    if (ctaData) {
      // Track CTA click in GTM
      trackCTAClick(ctaData.trackingType as any, car);
      
      // Open chat widget with pre-filled message
      openChat(ctaData.message);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!car) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-4">Vehicle not found</h1>
          <button onClick={() => setLocation("/")} className="text-primary hover:underline">
            Back to Inventory
          </button>
        </div>
      </div>
    );
  }

  const monthlyPayment = calculateMonthlyPayment(car.price, selectedTerm, downPayment, apr);

  const nextImage = () => {
    if (car && car.images.length > 0) {
      setCurrentImageIndex((prev) => (prev + 1) % car.images.length);
    }
  };

  const prevImage = () => {
    if (car && car.images.length > 0) {
      setCurrentImageIndex((prev) => (prev - 1 + car.images.length) % car.images.length);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      
      <div className="pt-28 pb-20 px-4 max-w-7xl mx-auto">
        <button 
          onClick={() => setLocation("/")}
          className="mb-6 flex items-center gap-2 text-slate-500 hover:text-primary transition font-medium"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Inventory
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column: Full Carousel */}
          <div className="space-y-4">
            {/* Main Carousel */}
            <div className="aspect-[4/3] rounded-2xl overflow-hidden shadow-lg relative group">
              <img 
                src={car.images[currentImageIndex] || '/placeholder-car.jpg'} 
                alt={`${car.model} - Image ${currentImageIndex + 1}`} 
                className="w-full h-full object-cover transition-all duration-300" 
              />
              
              {/* Dealership Badge */}
              <div className="absolute top-4 left-4">
                <span className="bg-primary text-white text-sm font-bold px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  {car.dealership}
                </span>
              </div>

              {/* CarGurus Deal Rating Badge */}
              {car.dealRating && (
                <div className="absolute top-4 left-4 mt-12">
                  <span className="bg-green-500 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg">
                    {car.dealRating}
                  </span>
                </div>
              )}

              <div className="absolute top-4 right-4 flex gap-2">
                <button className="p-2 bg-white/90 backdrop-blur rounded-full text-slate-600 hover:text-red-500 transition shadow-sm">
                  <Heart className="w-5 h-5" />
                </button>
                <button className="p-2 bg-white/90 backdrop-blur rounded-full text-slate-600 hover:text-primary transition shadow-sm">
                  <Share2 className="w-5 h-5" />
                </button>
              </div>

              {/* Carousel Navigation */}
              {car.images.length > 1 && (
                <>
                  <button
                    onClick={prevImage}
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 backdrop-blur rounded-full flex items-center justify-center text-slate-900 opacity-0 group-hover:opacity-100 transition shadow-lg hover:scale-110"
                    data-testid="button-prev-image"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                  <button
                    onClick={nextImage}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 backdrop-blur rounded-full flex items-center justify-center text-slate-900 opacity-0 group-hover:opacity-100 transition shadow-lg hover:scale-110"
                    data-testid="button-next-image"
                  >
                    <ChevronRight className="w-6 h-6" />
                  </button>
                </>
              )}

              {/* Image Indicators */}
              {car.images.length > 1 && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
                  {car.images.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setCurrentImageIndex(i)}
                      className={`h-1.5 rounded-full transition-all ${
                        i === currentImageIndex ? 'w-6 bg-white' : 'w-1.5 bg-white/50'
                      }`}
                      data-testid={`indicator-image-${i}`}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* AI-Generated Vehicle Video (Gemini Veo) */}
            {car.videoUrl && (
              <div className="aspect-video rounded-2xl overflow-hidden shadow-lg relative group bg-black">
                <video 
                  src={`/${car.videoUrl}`}
                  controls
                  loop
                  muted
                  autoPlay
                  playsInline
                  className="w-full h-full object-contain"
                  data-testid="video-vehicle-showcase"
                />
                <div className="absolute top-4 left-4 z-10">
                  <span className="bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" />
                    </svg>
                    AI-Generated Video
                  </span>
                </div>
              </div>
            )}

            {/* Thumbnail Grid */}
            <div className="grid grid-cols-5 gap-2">
              {car.images.slice(0, 5).map((img, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentImageIndex(i)}
                  className={`aspect-[4/3] rounded-lg overflow-hidden shadow-sm cursor-pointer transition-all ${
                    i === currentImageIndex ? 'ring-2 ring-primary opacity-100' : 'opacity-60 hover:opacity-100'
                  }`}
                  data-testid={`thumbnail-${i}`}
                >
                  <img src={img} alt={`Thumbnail ${i + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>

          {/* Right Column: Details */}
          <div className="space-y-6">
            <div className="glass-panel p-8 rounded-2xl">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h1 className="text-3xl font-black text-slate-900 mb-2">{car.year} {car.make} {car.model}</h1>
                  <p className="text-lg text-slate-500 font-medium">{car.trim}</p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-black text-primary">${car.price.toLocaleString()}</p>
                  <p className="text-sm text-slate-400">Cash Price</p>
                </div>
              </div>

              <div className="flex gap-2 mb-6 flex-wrap">
                {car.badges.map((b: string) => (
                  <span key={b} className="bg-blue-50 text-primary px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border border-blue-100 flex items-center gap-1">
                    <Flame className="w-3 h-3 text-orange-500" />
                    {b}
                  </span>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-4 mb-8 p-4 bg-slate-50 rounded-xl border border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-slate-400 shadow-sm"><Gauge className="w-5 h-5" /></div>
                  <div>
                    <p className="text-xs text-slate-400 font-bold uppercase">Odometer</p>
                    <p className="font-bold text-slate-700">{car.odometer.toLocaleString()} km</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-slate-400 shadow-sm"><MapPin className="w-5 h-5" /></div>
                  <div>
                    <p className="text-xs text-slate-400 font-bold uppercase">Location</p>
                    <p className="font-bold text-slate-700">{car.location}</p>
                  </div>
                </div>
                 <div className="flex items-center gap-3 col-span-2">
                  <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-orange-400 shadow-sm"><Flame className="w-5 h-5" /></div>
                  <div>
                    <p className="text-xs text-slate-400 font-bold uppercase">Interest (24h)</p>
                    <p className="font-bold text-slate-700">{car.views} people viewing</p>
                  </div>
                </div>
              </div>

              <div className="bg-primary/5 border border-primary/10 p-6 rounded-xl mb-4">
                <div className="flex justify-between items-center mb-3">
                  <p className="font-bold text-slate-900">Estimated Finance</p>
                  <p className="text-2xl font-black text-primary">${monthlyPayment}<span className="text-sm text-slate-500 font-medium">/mo</span></p>
                </div>
                <p className="text-xs text-slate-500 mb-4">
                  Based on {apr}% APR, ${downPayment.toLocaleString()} down. Taxes and fees extra.
                </p>
                
                {/* Term Selector */}
                <div className="space-y-2">
                  <p className="text-xs font-bold text-slate-400 uppercase">Select Term</p>
                  <div className="grid grid-cols-5 gap-2">
                    {FINANCE_TERMS.map(term => (
                      <button
                        key={term}
                        onClick={() => setSelectedTerm(term)}
                        className={`py-2 rounded-lg text-sm font-bold transition ${
                          selectedTerm === term 
                            ? 'bg-secondary text-white shadow-md' 
                            : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                        }`}
                      >
                        {term}mo
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Primary CTAs */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <button 
                  onClick={() => handleAction("Get Pre-Approved")} 
                  className="w-full bg-secondary hover:bg-secondary/90 text-white py-4 rounded-xl font-bold text-base shadow-lg shadow-cyan-500/20 transition flex items-center justify-center gap-2"
                  data-testid="button-get-approved"
                >
                  <CheckCircle2 className="w-5 h-5" /> Get Pre-Approved
                </button>
                <button 
                  onClick={() => handleAction("Book Test Drive")} 
                  className="w-full bg-primary hover:bg-blue-900 text-white py-4 rounded-xl font-bold text-base shadow-lg transition flex items-center justify-center gap-2"
                  data-testid="button-book-test-drive"
                >
                  <Calendar className="w-5 h-5" /> Book Test Drive
                </button>
              </div>

              {/* Secondary CTAs */}
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => handleAction("Value Your Trade-in")} 
                  className="w-full bg-white border-2 border-slate-200 hover:border-primary text-slate-700 hover:text-primary py-3 rounded-lg font-bold text-sm transition flex items-center justify-center gap-2"
                  data-testid="button-value-trade"
                >
                  <DollarSign className="w-4 h-4" /> Value Trade-in
                </button>
                <button 
                  onClick={() => handleAction("Reserve Vehicle")} 
                  className="w-full bg-white border-2 border-slate-200 hover:border-secondary text-slate-700 hover:text-secondary py-3 rounded-lg font-bold text-sm transition flex items-center justify-center gap-2"
                  data-testid="button-reserve-vehicle"
                >
                  <Car className="w-4 h-4" /> Reserve Now
                </button>
              </div>
            </div>

            <div className="glass-panel p-8 rounded-2xl">
              <h3 className="font-bold text-lg mb-4">Vehicle Description</h3>
              <p className="text-slate-600 leading-relaxed">{car.description}</p>
            </div>
          </div>
        </div>
      </div>

      <ChatBot 
        vehicleName={`${car.year} ${car.make} ${car.model}`} 
        action={action}
        vehicle={{
          id: car.id,
          make: car.make,
          model: car.model,
          year: car.year,
          price: car.price,
          vin: car.vin,
          dealership: car.dealership,
          type: car.type
        }}
      />
    </div>
  );
}
