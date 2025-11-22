import { FilterState } from "@/lib/types";
import { LOCATIONS, BODY_STYLES } from "@/lib/mockData";
import { SlidersHorizontal, MapPin, CarFront, DollarSign, Check } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";

interface InventorySidebarProps {
  filters: FilterState;
  setFilters: (filters: FilterState) => void;
}

export function InventorySidebar({ filters, setFilters }: InventorySidebarProps) {
  
  const handleTypeChange = (type: string) => {
    // If clicking the currently selected type (and it's not 'all'), deselect it back to 'all'
    // Or standard radio behavior: select new type
    const newType = filters.type === type ? 'all' : type;
    setFilters({ ...filters, type: newType });
  };

  const handleLocationChange = (loc: string) => {
    // Toggle logic if we wanted multiple locations, but let's keep it simple first: Single select or All
    // Or let's allow 'all' vs specific
    const newLoc = filters.location === loc ? 'all' : loc;
    setFilters({ ...filters, location: newLoc });
  };

  return (
    <aside className="w-full lg:w-64 flex-shrink-0 space-y-6">
      <div className="glass-panel p-6 rounded-2xl sticky top-24">
        <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4" /> Filters
        </h3>

        {/* Location Filter */}
        <div className="mb-8">
          <p className="text-xs font-bold text-slate-400 uppercase mb-3 flex items-center gap-2">
            <MapPin className="w-3 h-3" /> Location
          </p>
          <div className="space-y-2">
            <label className="flex items-center gap-3 cursor-pointer group">
              <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${filters.location === 'all' ? 'bg-primary border-primary text-white' : 'border-slate-300 bg-white'}`}>
                {filters.location === 'all' && <Check className="w-3 h-3" />}
              </div>
              <input 
                type="radio" 
                name="location" 
                className="hidden" 
                checked={filters.location === 'all'} 
                onChange={() => setFilters({ ...filters, location: 'all' })}
              />
              <span className={`text-sm font-medium transition ${filters.location === 'all' ? 'text-primary' : 'text-slate-600 group-hover:text-primary'}`}>All Locations</span>
            </label>
            {LOCATIONS.map(loc => (
               <label key={loc} className="flex items-center gap-3 cursor-pointer group">
                <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${filters.location === loc ? 'bg-primary border-primary text-white' : 'border-slate-300 bg-white'}`}>
                  {filters.location === loc && <Check className="w-3 h-3" />}
                </div>
                <input 
                  type="radio" 
                  name="location" 
                  className="hidden" 
                  checked={filters.location === loc} 
                  onChange={() => handleLocationChange(loc)}
                />
                <span className={`text-sm font-medium transition ${filters.location === loc ? 'text-primary' : 'text-slate-600 group-hover:text-primary'}`}>{loc}</span>
              </label>
            ))}
          </div>
        </div>
        
        {/* Body Style Filter */}
        <div className="mb-8">
          <p className="text-xs font-bold text-slate-400 uppercase mb-3 flex items-center gap-2">
            <CarFront className="w-3 h-3" /> Body Style
          </p>
          <div className="space-y-2">
            <label className="flex items-center gap-3 cursor-pointer group">
              <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${filters.type === 'all' ? 'bg-primary border-primary text-white' : 'border-slate-300 bg-white'}`}>
                {filters.type === 'all' && <Check className="w-3 h-3" />}
              </div>
              <input 
                type="radio" 
                name="type" 
                className="hidden" 
                checked={filters.type === 'all'} 
                onChange={() => setFilters({ ...filters, type: 'all' })}
              />
              <span className={`text-sm font-medium transition ${filters.type === 'all' ? 'text-primary' : 'text-slate-600 group-hover:text-primary'}`}>All Styles</span>
            </label>
            {BODY_STYLES.map(style => (
              <label key={style} className="flex items-center gap-3 cursor-pointer group">
                <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${filters.type === style ? 'bg-primary border-primary text-white' : 'border-slate-300 bg-white'}`}>
                  {filters.type === style && <Check className="w-3 h-3" />}
                </div>
                <input 
                  type="radio" 
                  name="type" 
                  className="hidden" 
                  checked={filters.type === style} 
                  onChange={() => handleTypeChange(style)}
                />
                <span className={`text-sm font-medium transition ${filters.type === style ? 'text-primary' : 'text-slate-600 group-hover:text-primary'}`}>{style}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Price Slider */}
        <div>
          <div className="flex justify-between text-xs font-bold text-slate-400 uppercase mb-4">
            <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" /> Max Price</span>
            <span className="text-primary">${filters.priceMax.toLocaleString()}</span>
          </div>
          <Slider 
            defaultValue={[filters.priceMax]} 
            max={100000} 
            min={10000} 
            step={1000} 
            onValueChange={(val) => setFilters({ ...filters, priceMax: val[0] })}
            className="py-4"
          />
        </div>
      </div>
    </aside>
  );
}
