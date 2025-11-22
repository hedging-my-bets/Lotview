import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { Navbar } from "@/components/Navbar";
import { ChatBot } from "@/components/ChatBot";
import { MOCK_INVENTORY } from "@/lib/mockData";
import { ArrowLeft, Calendar, CheckCircle2, MapPin, Gauge, Flame, Share2, Heart } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function VehicleDetail() {
  const [match, params] = useRoute("/vehicle/:id");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [viewCount, setViewCount] = useState(0);

  const car = MOCK_INVENTORY.find(c => c.id === Number(params?.id));

  useEffect(() => {
    if (car) {
      // Simulate view tracking
      console.log(`Tracked view for vehicle ${car.id} for remarketing.`);
      setViewCount(car.views + Math.floor(Math.random() * 10));
    }
  }, [car]);

  if (!car) return <div>Vehicle not found</div>;

  const monthlyPayment = Math.floor((car.price * 1.05) / 84 * 1.07);

  const handleAction = (action: string) => {
    toast({
      title: "Request Sent",
      description: `We've received your request to ${action}. A representative will contact you shortly.`,
    });
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
          {/* Left Column: Images */}
          <div className="space-y-4">
            <div className="aspect-[4/3] rounded-2xl overflow-hidden shadow-lg relative group">
              <img src={car.image} alt={car.model} className="w-full h-full object-cover" />
              <div className="absolute top-4 right-4 flex gap-2">
                <button className="p-2 bg-white/90 backdrop-blur rounded-full text-slate-600 hover:text-red-500 transition shadow-sm">
                  <Heart className="w-5 h-5" />
                </button>
                <button className="p-2 bg-white/90 backdrop-blur rounded-full text-slate-600 hover:text-primary transition shadow-sm">
                  <Share2 className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {[1,2,3].map(i => (
                <div key={i} className="aspect-[4/3] rounded-xl overflow-hidden shadow-sm opacity-70 hover:opacity-100 cursor-pointer transition">
                   <img src={car.image} alt="Gallery" className="w-full h-full object-cover" />
                </div>
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

              <div className="flex gap-2 mb-6">
                {car.badges.map(b => (
                  <span key={b} className="bg-blue-50 text-primary px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border border-blue-100">
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
                 <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-orange-400 shadow-sm"><Flame className="w-5 h-5" /></div>
                  <div>
                    <p className="text-xs text-slate-400 font-bold uppercase">Interest</p>
                    <p className="font-bold text-slate-700">{viewCount} people viewing</p>
                  </div>
                </div>
              </div>

              <div className="bg-primary/5 border border-primary/10 p-6 rounded-xl mb-6">
                <div className="flex justify-between items-center mb-2">
                  <p className="font-bold text-slate-900">Estimated Finance</p>
                  <p className="text-2xl font-black text-primary">${monthlyPayment}<span className="text-sm text-slate-500 font-medium">/mo</span></p>
                </div>
                <p className="text-xs text-slate-500">Based on 6.99% APR for 84 months. $0 down. Taxes and fees extra.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button onClick={() => handleAction("Get Pre-Approved")} className="btn-primary w-full bg-secondary hover:bg-secondary/90 text-white py-4 rounded-xl font-bold text-lg shadow-lg shadow-cyan-500/20 transition flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-5 h-5" /> Get Pre-Approved
                </button>
                <button onClick={() => handleAction("Book Test Drive")} className="btn-secondary w-full bg-white border-2 border-slate-200 hover:border-primary text-slate-700 hover:text-primary py-4 rounded-xl font-bold text-lg transition flex items-center justify-center gap-2">
                  <Calendar className="w-5 h-5" /> Book Test Drive
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

      <ChatBot vehicleName={`${car.year} ${car.make} ${car.model}`} />
    </div>
  );
}
