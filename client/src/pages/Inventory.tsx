import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Navbar } from "@/components/Navbar";
import { InventorySidebar } from "@/components/InventorySidebar";
import { VehicleCard } from "@/components/VehicleCard";
import { ChatBot } from "@/components/ChatBot";
import { StickyPaymentBar } from "@/components/StickyPaymentBar";
import { getVehicles } from "@/lib/api";
import { FilterState } from "@/lib/types";
import { Loader2, LogIn } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Inventory() {
  const { toast } = useToast();
  const [filters, setFilters] = useState<FilterState>({
    type: 'all',
    priceMax: 100000,
    location: 'all',
    dealership: 'all',
    search: ''
  });

  const { data: vehicles = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ["vehicles"],
    queryFn: getVehicles,
  });

  const filteredInventory = vehicles.filter(car => {
    const matchesType = filters.type === 'all' || car.type === filters.type;
    const matchesPrice = car.price <= filters.priceMax;
    const matchesLocation = filters.location === 'all' || car.location === filters.location;
    const matchesDealership = filters.dealership === 'all' || car.dealership === filters.dealership;
    return matchesType && matchesPrice && matchesLocation && matchesDealership;
  });

  const handleRefresh = () => {
    toast({ title: "Checking for updates...", description: "Syncing with dealer networks." });
    refetch().then(() => {
      toast({ title: "Inventory Updated", description: "Inventory is up to date." });
    });
  };

  const handleLogin = () => {
    toast({ title: "Login", description: "Sales team login coming soon..." });
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <StickyPaymentBar />
      
      <div className="pt-28 pb-20 px-4 max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row gap-8">
          <InventorySidebar filters={filters} setFilters={setFilters} />
          
          <main className="flex-1">
            <div className="mb-6 flex justify-between items-end">
              <h2 className="text-2xl font-bold text-slate-900">
                Inventory <span className="text-slate-400 font-normal text-lg ml-2">{filteredInventory.length} Vehicles</span>
              </h2>
              <button 
                onClick={handleRefresh}
                disabled={isFetching}
                className="text-xs font-bold text-green-600 bg-green-100 px-3 py-1 rounded-full hover:bg-green-200 transition flex items-center gap-2 disabled:opacity-50"
              >
                {isFetching ? <Loader2 className="w-3 h-3 animate-spin" /> : <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span></span>}
                {isFetching ? "Updating..." : "Live Updates"}
              </button>
            </div>

            {isLoading ? (
              <div className="flex justify-center items-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : filteredInventory.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <p>No vehicles match your criteria.</p>
                <button onClick={() => setFilters({ type: 'all', priceMax: 100000, location: 'all', dealership: 'all', search: '' })} className="text-primary font-bold mt-2 hover:underline">Clear Filters</button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredInventory.map(car => (
                  <VehicleCard key={car.id} car={car} />
                ))}
              </div>
            )}
          </main>
        </div>

        {/* Login Button at Bottom */}
        <div className="mt-12 flex justify-center">
          <button 
            onClick={handleLogin}
            className="glass-panel px-6 py-3 rounded-xl font-bold text-slate-600 hover:text-primary hover:border-primary transition flex items-center gap-2 border-2 border-slate-200"
          >
            <LogIn className="w-4 h-4" />
            Sales Team Login
          </button>
        </div>
      </div>

      <ChatBot />
    </div>
  );
}
