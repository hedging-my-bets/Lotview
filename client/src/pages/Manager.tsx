import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogOut, Search, TrendingUp, Car, ChevronDown, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export default function Manager() {
  const [, setLocation] = useLocation();
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  // VIN state
  const [vin, setVin] = useState("");
  const [vinResults, setVinResults] = useState<any>(null);
  const [isDecoding, setIsDecoding] = useState(false);

  // Market pricing state
  const [pricingForm, setPricingForm] = useState({
    year: "",
    make: "",
    model: "",
    trim: "",
    mileage: "",
    radius: "50"
  });
  const [pricingResults, setPricingResults] = useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Autocomplete data
  const [makes, setMakes] = useState<string[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [trims, setTrims] = useState<string[]>([]);

  // Popover states for autocomplete
  const [makeOpen, setMakeOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [trimOpen, setTrimOpen] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  // Load autocomplete options when form values change
  useEffect(() => {
    if (user) {
      loadMakes();
    }
  }, [user]);

  useEffect(() => {
    if (pricingForm.make) {
      loadModels(pricingForm.make);
    } else {
      setModels([]);
    }
    // Clear model and trim when make changes
    if (pricingForm.make !== vinResults?.make) {
      setPricingForm(prev => ({ ...prev, model: "", trim: "" }));
    }
  }, [pricingForm.make]);

  useEffect(() => {
    if (pricingForm.make && pricingForm.model) {
      loadTrims(pricingForm.make, pricingForm.model);
    } else {
      setTrims([]);
    }
    // Clear trim when model changes
    if (pricingForm.model !== vinResults?.model) {
      setPricingForm(prev => ({ ...prev, trim: "" }));
    }
  }, [pricingForm.make, pricingForm.model]);

  const checkAuth = async () => {
    const token = localStorage.getItem('auth_token');
    const storedUser = localStorage.getItem('user');

    if (!token || !storedUser) {
      setLocation('/login');
      return;
    }

    try {
      const parsedUser = JSON.parse(storedUser);
      
      if (parsedUser.role !== 'manager') {
        toast({
          title: "Access Denied",
          description: "You don't have permission to access this page",
          variant: "destructive",
        });
        setLocation('/');
        return;
      }

      setUser(parsedUser);
    } catch (error) {
      console.error("Auth check failed:", error);
      setLocation('/login');
    } finally {
      setIsLoading(false);
    }
  };

  const loadMakes = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/inventory/makes', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setMakes(data);
      }
    } catch (error) {
      console.error("Error loading makes:", error);
    }
  };

  const loadModels = async (make: string) => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/inventory/models?make=${encodeURIComponent(make)}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setModels(data);
      }
    } catch (error) {
      console.error("Error loading models:", error);
    }
  };

  const loadTrims = async (make: string, model: string) => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/inventory/trims?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setTrims(data);
      }
    } catch (error) {
      console.error("Error loading trims:", error);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
    setLocation('/login');
  };

  const handleVinDecode = async () => {
    if (vin.length !== 17) {
      toast({
        title: "Invalid VIN",
        description: "VIN must be exactly 17 characters",
        variant: "destructive",
      });
      return;
    }

    setIsDecoding(true);
    setVinResults(null);

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/manager/decode-vin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ vin }),
      });

      const result = await response.json();
      
      if (result.errorCode) {
        toast({
          title: "Decode Failed",
          description: result.errorMessage || "Unable to decode VIN",
          variant: "destructive",
        });
      } else {
        setVinResults(result);
        
        // Auto-populate market pricing form
        setPricingForm({
          year: result.year || "",
          make: result.make || "",
          model: result.model || "",
          trim: result.trim || "",
          mileage: "",
          radius: pricingForm.radius || "50"
        });

        toast({
          title: "VIN Decoded Successfully",
          description: `${result.year || ''} ${result.make || ''} ${result.model || ''}`.trim(),
        });

        // Auto-trigger market analysis
        setTimeout(() => {
          if (result.year && result.make && result.model) {
            analyzeMarket(result.year, result.make, result.model, result.trim || "", "", pricingForm.radius || "50");
          }
        }, 500);
      }
    } catch (error) {
      console.error("VIN decode error:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to decode VIN. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDecoding(false);
    }
  };

  const analyzeMarket = async (year: string, make: string, model: string, trim: string, mileage: string, radius: string) => {
    setIsAnalyzing(true);
    setPricingResults(null);

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/manager/market-pricing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          year: parseInt(year),
          make,
          model,
          trim: trim || undefined,
          mileage: mileage ? parseInt(mileage) : undefined,
          radius: parseInt(radius) || 50
        }),
      });

      const result = await response.json();
      
      if (result.error) {
        toast({
          title: "Analysis Failed",
          description: result.message || "Unable to analyze market pricing",
          variant: "destructive",
        });
      } else {
        setPricingResults(result);
        toast({
          title: "Analysis Complete",
          description: `Found ${result.totalComps} comparable vehicles`,
        });
      }
    } catch (error) {
      console.error("Market pricing error:", error);
      toast({
        title: "Error",
        description: "Failed to analyze market pricing. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleMarketSearch = () => {
    if (!pricingForm.year || !pricingForm.make || !pricingForm.model) {
      toast({
        title: "Missing Information",
        description: "Please select year, make, and model to search",
        variant: "destructive",
      });
      return;
    }

    analyzeMarket(pricingForm.year, pricingForm.make, pricingForm.model, pricingForm.trim, pricingForm.mileage, pricingForm.radius);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-500">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <div className="pt-28 pb-12 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 mb-2">Sales Manager Dashboard</h1>
              <p className="text-slate-600">Welcome back, {user?.name}</p>
            </div>
            <Button onClick={handleLogout} variant="outline" data-testid="button-logout">
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>VIN Decoder & Market Pricing Analysis</CardTitle>
              <CardDescription>
                Decode VINs to get vehicle specifications and automatic market pricing analysis
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-8">
                {/* VIN Decoder Section */}
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="vin">Vehicle Identification Number (VIN)</Label>
                    <div className="flex gap-2 mt-2">
                      <Input
                        id="vin"
                        placeholder="Enter 17-character VIN"
                        value={vin}
                        onChange={(e) => setVin(e.target.value.toUpperCase())}
                        maxLength={17}
                        className="font-mono"
                        data-testid="input-vin"
                      />
                      <Button 
                        onClick={handleVinDecode}
                        disabled={vin.length !== 17 || isDecoding}
                        data-testid="button-decode-vin"
                      >
                        {isDecoding ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                            Decoding...
                          </>
                        ) : (
                          <>
                            <Search className="w-4 h-4 mr-2" />
                            Decode VIN
                          </>
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Enter a valid 17-character VIN to decode and auto-populate market analysis
                    </p>
                  </div>
                </div>

                {/* VIN Results */}
                {vinResults && (
                  <div className="border-t pt-6" data-testid="vin-results">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                      <h3 className="text-xl font-bold text-slate-900 mb-4">
                        {vinResults.year} {vinResults.make} {vinResults.model}
                        {vinResults.trim && ` ${vinResults.trim}`}
                      </h3>
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {vinResults.year && (
                          <div data-testid="result-year">
                            <div className="text-xs text-slate-500 font-medium">Year</div>
                            <div className="text-sm font-semibold">{vinResults.year}</div>
                          </div>
                        )}
                        {vinResults.make && (
                          <div data-testid="result-make">
                            <div className="text-xs text-slate-500 font-medium">Make</div>
                            <div className="text-sm font-semibold">{vinResults.make}</div>
                          </div>
                        )}
                        {vinResults.model && (
                          <div data-testid="result-model">
                            <div className="text-xs text-slate-500 font-medium">Model</div>
                            <div className="text-sm font-semibold">{vinResults.model}</div>
                          </div>
                        )}
                        {vinResults.trim && (
                          <div data-testid="result-trim">
                            <div className="text-xs text-slate-500 font-medium">Trim</div>
                            <div className="text-sm font-semibold">{vinResults.trim}</div>
                          </div>
                        )}
                        {vinResults.bodyClass && (
                          <div data-testid="result-body-class">
                            <div className="text-xs text-slate-500 font-medium">Body Class</div>
                            <div className="text-sm font-semibold">{vinResults.bodyClass}</div>
                          </div>
                        )}
                        {vinResults.vehicleType && (
                          <div data-testid="result-vehicle-type">
                            <div className="text-xs text-slate-500 font-medium">Vehicle Type</div>
                            <div className="text-sm font-semibold">{vinResults.vehicleType}</div>
                          </div>
                        )}
                        {vinResults.fuelType && (
                          <div data-testid="result-fuel-type">
                            <div className="text-xs text-slate-500 font-medium">Fuel Type</div>
                            <div className="text-sm font-semibold">{vinResults.fuelType}</div>
                          </div>
                        )}
                        {vinResults.transmission && (
                          <div data-testid="result-transmission">
                            <div className="text-xs text-slate-500 font-medium">Transmission</div>
                            <div className="text-sm font-semibold">{vinResults.transmission}</div>
                          </div>
                        )}
                        {vinResults.driveType && (
                          <div data-testid="result-drive-type">
                            <div className="text-xs text-slate-500 font-medium">Drive Type</div>
                            <div className="text-sm font-semibold">{vinResults.driveType}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Market Pricing Section */}
                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">Market Pricing Analysis</h3>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {/* Year Input */}
                    <div>
                      <Label htmlFor="year">Year *</Label>
                      <Input
                        id="year"
                        placeholder="e.g., 2023"
                        type="number"
                        value={pricingForm.year}
                        onChange={(e) => setPricingForm({ ...pricingForm, year: e.target.value })}
                        data-testid="input-year"
                        className="mt-2"
                      />
                    </div>

                    {/* Make Autocomplete */}
                    <div>
                      <Label>Make *</Label>
                      <Popover open={makeOpen} onOpenChange={setMakeOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={makeOpen}
                            className="w-full justify-between mt-2"
                            data-testid="select-make"
                          >
                            {pricingForm.make || "Select make..."}
                            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[300px] p-0">
                          <Command>
                            <CommandInput placeholder="Search make..." />
                            <CommandList>
                              <CommandEmpty>No make found.</CommandEmpty>
                              <CommandGroup>
                                {makes.map((make) => (
                                  <CommandItem
                                    key={make}
                                    value={make}
                                    onSelect={() => {
                                      setPricingForm({ ...pricingForm, make, model: "", trim: "" });
                                      setMakeOpen(false);
                                    }}
                                    data-testid={`option-make-${make.toLowerCase()}`}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        pricingForm.make === make ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    {make}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>

                    {/* Model Autocomplete */}
                    <div>
                      <Label>Model *</Label>
                      <Popover open={modelOpen} onOpenChange={setModelOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={modelOpen}
                            className="w-full justify-between mt-2"
                            disabled={!pricingForm.make}
                            data-testid="select-model"
                          >
                            {pricingForm.model || "Select model..."}
                            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[300px] p-0">
                          <Command>
                            <CommandInput placeholder="Search model..." />
                            <CommandList>
                              <CommandEmpty>No model found.</CommandEmpty>
                              <CommandGroup>
                                {models.map((model) => (
                                  <CommandItem
                                    key={model}
                                    value={model}
                                    onSelect={() => {
                                      setPricingForm({ ...pricingForm, model, trim: "" });
                                      setModelOpen(false);
                                    }}
                                    data-testid={`option-model-${model.toLowerCase()}`}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        pricingForm.model === model ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    {model}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>

                    {/* Trim Autocomplete */}
                    <div>
                      <Label>Trim (Optional)</Label>
                      <Popover open={trimOpen} onOpenChange={setTrimOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={trimOpen}
                            className="w-full justify-between mt-2"
                            disabled={!pricingForm.model}
                            data-testid="select-trim"
                          >
                            {pricingForm.trim || "Select trim..."}
                            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[300px] p-0">
                          <Command>
                            <CommandInput placeholder="Search trim..." />
                            <CommandList>
                              <CommandEmpty>No trim found.</CommandEmpty>
                              <CommandGroup>
                                {trims.map((trim) => (
                                  <CommandItem
                                    key={trim}
                                    value={trim}
                                    onSelect={() => {
                                      setPricingForm({ ...pricingForm, trim });
                                      setTrimOpen(false);
                                    }}
                                    data-testid={`option-trim-${trim.toLowerCase()}`}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        pricingForm.trim === trim ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    {trim}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>

                    {/* Mileage Input */}
                    <div>
                      <Label htmlFor="mileage">Mileage (Optional)</Label>
                      <Input
                        id="mileage"
                        type="number"
                        placeholder="e.g., 25000"
                        value={pricingForm.mileage}
                        onChange={(e) => setPricingForm({ ...pricingForm, mileage: e.target.value })}
                        data-testid="input-mileage"
                        className="mt-2"
                      />
                    </div>

                    {/* Radius Input */}
                    <div>
                      <Label htmlFor="radius">Search Radius (miles)</Label>
                      <Input
                        id="radius"
                        type="number"
                        value={pricingForm.radius}
                        onChange={(e) => setPricingForm({ ...pricingForm, radius: e.target.value })}
                        data-testid="input-radius"
                        className="mt-2"
                      />
                    </div>
                  </div>

                  <Button 
                    onClick={handleMarketSearch} 
                    className="w-full md:w-auto mt-6"
                    disabled={isAnalyzing || !pricingForm.year || !pricingForm.make || !pricingForm.model}
                    data-testid="button-search-market"
                  >
                    {isAnalyzing ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <TrendingUp className="w-4 h-4 mr-2" />
                        Analyze Market Pricing
                      </>
                    )}
                  </Button>
                </div>

                {/* Market Pricing Results */}
                {pricingResults && (
                  <div className="border-t pt-6" data-testid="pricing-results">
                    <div className="space-y-6">
                      {/* Market Statistics */}
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                        <h3 className="text-xl font-bold text-slate-900 mb-4">
                          Market Analysis: {pricingForm.year} {pricingForm.make} {pricingForm.model}
                        </h3>
                        <div className="grid gap-4 md:grid-cols-4">
                          <div data-testid="stat-average-price">
                            <div className="text-xs text-slate-500 font-medium">Average Price</div>
                            <div className="text-2xl font-bold text-green-600">
                              ${pricingResults.averagePrice.toLocaleString()}
                            </div>
                          </div>
                          <div data-testid="stat-median-price">
                            <div className="text-xs text-slate-500 font-medium">Median Price</div>
                            <div className="text-2xl font-bold">${pricingResults.medianPrice.toLocaleString()}</div>
                          </div>
                          <div data-testid="stat-price-range">
                            <div className="text-xs text-slate-500 font-medium">Price Range</div>
                            <div className="text-lg font-semibold">
                              ${pricingResults.minPrice.toLocaleString()} - ${pricingResults.maxPrice.toLocaleString()}
                            </div>
                          </div>
                          <div data-testid="stat-total-comps">
                            <div className="text-xs text-slate-500 font-medium">Comparables Found</div>
                            <div className="text-2xl font-bold">{pricingResults.totalComps}</div>
                          </div>
                        </div>
                      </div>

                      {/* Recommendation */}
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <h4 className="font-semibold text-slate-900 mb-2">Market Recommendation</h4>
                        <p className="text-sm text-slate-700">{pricingResults.recommendation}</p>
                        <div className="mt-3 text-sm">
                          <span className="font-medium">Recommended Price Range:</span>{' '}
                          <span className="font-semibold text-green-600">
                            ${pricingResults.priceRange.low.toLocaleString()} - ${pricingResults.priceRange.high.toLocaleString()}
                          </span>
                        </div>
                      </div>

                      {/* Comparable Vehicles */}
                      {pricingResults.comparisons && pricingResults.comparisons.length > 0 && (
                        <div>
                          <h4 className="font-semibold text-slate-900 mb-4">Comparable Vehicles</h4>
                          <div className="space-y-3">
                            {pricingResults.comparisons.slice(0, 10).map((comp: any, index: number) => (
                              <div 
                                key={index}
                                className="border rounded-lg p-4 hover:bg-slate-50"
                                data-testid={`comparison-${index}`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex-1">
                                    <div className="font-medium">
                                      {comp.year} {comp.make} {comp.model}
                                      {comp.trim && ` ${comp.trim}`}
                                    </div>
                                    <div className="text-sm text-slate-500 mt-1">
                                      Stock #{comp.stockNumber} • {comp.location} • {comp.dealership}
                                      {comp.mileage && ` • ${comp.mileage.toLocaleString()} mi`}
                                    </div>
                                  </div>
                                  <div className="text-right ml-4">
                                    <div className="font-bold text-lg">${comp.price.toLocaleString()}</div>
                                    <div className={`text-sm ${comp.priceDifference >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                                      {comp.priceDifference >= 0 ? '+' : ''}{comp.percentageDifference}% vs avg
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {!pricingResults && !vinResults && (
                  <div className="border-t pt-6">
                    <div className="text-center py-12 text-slate-500">
                      <Car className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                      <h3 className="text-lg font-medium mb-2">Get Started</h3>
                      <p className="text-sm mb-4">
                        Enter a VIN to decode and automatically analyze market pricing, or manually enter vehicle details
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
