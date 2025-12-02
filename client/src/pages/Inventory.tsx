import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Navbar } from "@/components/Navbar";
import { InventorySidebar } from "@/components/InventorySidebar";
import { VehicleCard } from "@/components/VehicleCard";
import { ChatBot } from "@/components/ChatBot";
import { StickyPaymentBar } from "@/components/StickyPaymentBar";
import { getVehicles } from "@/lib/api";
import { FilterState } from "@/lib/types";
import { Loader2, LogIn, SlidersHorizontal, Car, Truck } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";

export default function Inventory() {
  const { toast } = useToast();
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    type: 'all',
    priceMax: 100000,
    location: 'all',
    dealership: 'all',
    search: '',
    make: 'all',
    sortBy: 'default'
  });

  const { data: vehicles = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ["vehicles"],
    queryFn: getVehicles,
  });

  // Get unique makes from vehicles for the filter dropdown
  const uniqueMakes = Array.from(new Set(vehicles.map(car => car.make))).sort();

  // Body type priority for grouping (default sort)
  const typeOrder: Record<string, number> = { 'SUV': 1, 'Truck': 2, 'Sedan': 3 };
  const getTypeOrder = (type: string) => typeOrder[type] || 99;

  const filteredInventory = vehicles
    .filter(car => {
      const matchesType = filters.type === 'all' || car.type === filters.type;
      const matchesPrice = car.price <= filters.priceMax;
      const matchesLocation = filters.location === 'all' || car.location === filters.location;
      const matchesDealership = filters.dealership === 'all' || car.dealership === filters.dealership;
      const matchesMake = filters.make === 'all' || car.make === filters.make;
      const searchLower = filters.search.toLowerCase().trim();
      const matchesSearch = !searchLower || 
        car.make.toLowerCase().includes(searchLower) ||
        car.model.toLowerCase().includes(searchLower) ||
        `${car.year}`.includes(searchLower) ||
        (car.vin && car.vin.toLowerCase().includes(searchLower)) ||
        (car.stockNumber && car.stockNumber.toLowerCase().includes(searchLower));
      return matchesType && matchesPrice && matchesLocation && matchesDealership && matchesMake && matchesSearch;
    })
    .sort((a, b) => {
      switch (filters.sortBy) {
        case 'price_low':
          return a.price - b.price;
        case 'price_high':
          return b.price - a.price;
        case 'km_low':
          return a.odometer - b.odometer;
        case 'km_high':
          return b.odometer - a.odometer;
        default:
          // Group by body type (SUV, Truck, Sedan)
          return getTypeOrder(a.type) - getTypeOrder(b.type);
      }
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
    <div className="min-h-screen bg-background">
      <Navbar />
      <StickyPaymentBar />
      
      <div className="pt-28 pb-24 md:pb-20 px-4 max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Desktop Sidebar - Hidden on Mobile */}
          <div className="hidden lg:block">
            <InventorySidebar filters={filters} setFilters={setFilters} availableMakes={uniqueMakes} />
          </div>
          
          <main className="flex-1">
            <div className="mb-4 flex justify-between items-center">
              <h2 className="text-2xl font-bold text-foreground">
                Inventory <span className="text-muted-foreground font-normal text-lg ml-2">{filteredInventory.length} Vehicles</span>
              </h2>
              {/* Mobile: Filter button, Desktop: Live Updates button */}
              <button 
                onClick={() => setIsFilterOpen(true)}
                className="lg:hidden flex text-xs font-bold text-primary bg-primary/10 px-3 py-1.5 rounded-full hover:bg-primary/20 transition items-center gap-2"
                data-testid="button-filters-header"
              >
                <SlidersHorizontal className="w-3 h-3" />
                Filters {filters.dealership !== 'all' || filters.location !== 'all' || filters.type !== 'all' || filters.priceMax !== 100000 || filters.make !== 'all' || filters.sortBy !== 'default' ? '(Active)' : ''}
              </button>
              <button 
                onClick={handleRefresh}
                disabled={isFetching}
                className="hidden lg:flex text-xs font-bold text-green-600 bg-green-100 px-3 py-1 rounded-full hover:bg-green-200 transition items-center gap-2 disabled:opacity-50"
              >
                {isFetching ? <Loader2 className="w-3 h-3 animate-spin" /> : <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span></span>}
                {isFetching ? "Updating..." : "Live Updates"}
              </button>
            </div>

            {/* Mobile Quick Type Filters - Hidden on Desktop */}
            <div className="lg:hidden flex gap-2 mb-6 overflow-x-auto pb-1">
              <button
                onClick={() => setFilters({ ...filters, type: filters.type === 'SUV' ? 'all' : 'SUV' })}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition ${
                  filters.type === 'SUV' 
                    ? 'bg-primary text-white' 
                    : 'bg-muted text-foreground hover:bg-muted/80'
                }`}
                data-testid="button-filter-suv"
              >
                <Car className="w-4 h-4" />
                SUV
              </button>
              <button
                onClick={() => setFilters({ ...filters, type: filters.type === 'Truck' ? 'all' : 'Truck' })}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition ${
                  filters.type === 'Truck' 
                    ? 'bg-primary text-white' 
                    : 'bg-muted text-foreground hover:bg-muted/80'
                }`}
                data-testid="button-filter-truck"
              >
                <Truck className="w-4 h-4" />
                Truck
              </button>
              <button
                onClick={() => setFilters({ ...filters, type: filters.type === 'Sedan' ? 'all' : 'Sedan' })}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition ${
                  filters.type === 'Sedan' 
                    ? 'bg-primary text-white' 
                    : 'bg-muted text-foreground hover:bg-muted/80'
                }`}
                data-testid="button-filter-sedan"
              >
                <Car className="w-4 h-4" />
                Sedan
              </button>
            </div>

            {isLoading ? (
              <div className="flex justify-center items-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : filteredInventory.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <p>No vehicles match your criteria.</p>
                <button onClick={() => setFilters({ type: 'all', priceMax: 100000, location: 'all', dealership: 'all', search: '', make: 'all', sortBy: 'default' })} className="text-primary font-bold mt-2 hover:underline">Clear Filters</button>
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
            className="glass-panel px-6 py-3 rounded-xl font-bold text-muted-foreground hover:text-primary hover:border-primary transition flex items-center gap-2 border-2 border-border"
          >
            <LogIn className="w-4 h-4" />
            Sales Team Login
          </button>
        </div>

        {/* Footer with Legal Links */}
        <footer className="mt-16 pt-8 border-t border-border">
          <div className="flex flex-col sm:flex-row justify-center items-center gap-4 text-sm text-muted-foreground">
            <span>&copy; {new Date().getFullYear()} Olympic Auto Group. All rights reserved.</span>
            <div className="flex items-center gap-4">
              <Link href="/privacy-policy">
                <span className="hover:text-primary hover:underline cursor-pointer" data-testid="link-privacy-footer">Privacy Policy</span>
              </Link>
              <span className="hidden sm:inline">|</span>
              <Link href="/terms-of-service">
                <span className="hover:text-primary hover:underline cursor-pointer" data-testid="link-terms-footer">Terms of Service</span>
              </Link>
            </div>
          </div>
        </footer>
      </div>

      {/* Mobile Filter Sheet - triggered from header button */}
      <Sheet open={isFilterOpen} onOpenChange={setIsFilterOpen}>
        <SheetContent side="left" className="w-[300px] overflow-y-auto p-0">
          <SheetHeader className="p-6 pb-4 border-b">
            <SheetTitle>Filter Vehicles</SheetTitle>
          </SheetHeader>
          <div className="p-6">
            <InventorySidebar filters={filters} setFilters={setFilters} availableMakes={uniqueMakes} />
          </div>
        </SheetContent>
      </Sheet>

      <ChatBot />
    </div>
  );
}
