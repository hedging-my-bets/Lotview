import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogOut, Search, TrendingUp, Car, DollarSign } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Manager() {
  const [, setLocation] = useLocation();
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const [vin, setVin] = useState("");
  const [searchRadius, setSearchRadius] = useState("50");
  const [vinResults, setVinResults] = useState<any>(null);
  const [isDecoding, setIsDecoding] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

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
        toast({
          title: "VIN Decoded Successfully",
          description: `${result.year || ''} ${result.make || ''} ${result.model || ''}`.trim(),
        });
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

  const handleMarketSearch = () => {
    toast({
      title: "Coming Soon",
      description: "Market pricing analysis will be available soon",
    });
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

          <Tabs defaultValue="vin-decoder" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="vin-decoder" data-testid="tab-vin-decoder">
                <Car className="w-4 h-4 mr-2" />
                VIN Decoder
              </TabsTrigger>
              <TabsTrigger value="market-pricing" data-testid="tab-market-pricing">
                <DollarSign className="w-4 h-4 mr-2" />
                Market Pricing
              </TabsTrigger>
            </TabsList>

            <TabsContent value="vin-decoder" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>VIN Decoder & Vehicle Information</CardTitle>
                  <CardDescription>
                    Decode VINs to get detailed vehicle specifications, options, and market value data
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
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
                                Decode
                              </>
                            )}
                          </Button>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          Enter a valid 17-character VIN to retrieve vehicle details
                        </p>
                      </div>
                    </div>

                    {vinResults ? (
                      <div className="border-t pt-6" data-testid="vin-results">
                        <div className="space-y-6">
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
                            </div>
                          </div>

                          <div className="grid gap-6 md:grid-cols-2">
                            <div className="border rounded-lg p-6">
                              <h4 className="font-semibold text-slate-900 mb-4">Powertrain</h4>
                              <div className="space-y-3">
                                {vinResults.engineCylinders && (
                                  <div data-testid="result-engine-cylinders">
                                    <div className="text-xs text-slate-500 font-medium">Engine Cylinders</div>
                                    <div className="text-sm">{vinResults.engineCylinders}</div>
                                  </div>
                                )}
                                {vinResults.engineHP && (
                                  <div data-testid="result-engine-hp">
                                    <div className="text-xs text-slate-500 font-medium">Engine HP</div>
                                    <div className="text-sm">{vinResults.engineHP}</div>
                                  </div>
                                )}
                                {vinResults.fuelType && (
                                  <div data-testid="result-fuel-type">
                                    <div className="text-xs text-slate-500 font-medium">Fuel Type</div>
                                    <div className="text-sm">{vinResults.fuelType}</div>
                                  </div>
                                )}
                                {vinResults.transmission && (
                                  <div data-testid="result-transmission">
                                    <div className="text-xs text-slate-500 font-medium">Transmission</div>
                                    <div className="text-sm">{vinResults.transmission}</div>
                                  </div>
                                )}
                                {vinResults.driveType && (
                                  <div data-testid="result-drive-type">
                                    <div className="text-xs text-slate-500 font-medium">Drive Type</div>
                                    <div className="text-sm">{vinResults.driveType}</div>
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="border rounded-lg p-6">
                              <h4 className="font-semibold text-slate-900 mb-4">Manufacturing</h4>
                              <div className="space-y-3">
                                {vinResults.manufacturer && (
                                  <div data-testid="result-manufacturer">
                                    <div className="text-xs text-slate-500 font-medium">Manufacturer</div>
                                    <div className="text-sm">{vinResults.manufacturer}</div>
                                  </div>
                                )}
                                {vinResults.plantCountry && (
                                  <div data-testid="result-plant-country">
                                    <div className="text-xs text-slate-500 font-medium">Plant Country</div>
                                    <div className="text-sm">{vinResults.plantCountry}</div>
                                  </div>
                                )}
                                {vinResults.doors && (
                                  <div data-testid="result-doors">
                                    <div className="text-xs text-slate-500 font-medium">Doors</div>
                                    <div className="text-sm">{vinResults.doors}</div>
                                  </div>
                                )}
                                <div data-testid="result-vin">
                                  <div className="text-xs text-slate-500 font-medium">VIN</div>
                                  <div className="text-sm font-mono">{vinResults.vin}</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="border-t pt-6">
                        <div className="text-center py-12 text-slate-500">
                          <Car className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                          <h3 className="text-lg font-medium mb-2">VIN Decoder Results</h3>
                          <p className="text-sm mb-4">
                            Enter a VIN above to see detailed vehicle information
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="market-pricing" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Competitive Market Pricing Analysis</CardTitle>
                  <CardDescription>
                    Analyze competitor pricing, market trends, and days-in-stock within your area
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <Label htmlFor="make">Make</Label>
                        <Input
                          id="make"
                          placeholder="e.g., Toyota"
                          data-testid="input-make"
                        />
                      </div>
                      <div>
                        <Label htmlFor="model">Model</Label>
                        <Input
                          id="model"
                          placeholder="e.g., Camry"
                          data-testid="input-model"
                        />
                      </div>
                      <div>
                        <Label htmlFor="year">Year Range</Label>
                        <div className="flex gap-2">
                          <Input
                            id="year"
                            placeholder="Min"
                            type="number"
                            data-testid="input-year-min"
                          />
                          <Input
                            placeholder="Max"
                            type="number"
                            data-testid="input-year-max"
                          />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="radius">Search Radius (km)</Label>
                        <Input
                          id="radius"
                          type="number"
                          value={searchRadius}
                          onChange={(e) => setSearchRadius(e.target.value)}
                          data-testid="input-radius"
                        />
                      </div>
                    </div>

                    <Button 
                      onClick={handleMarketSearch} 
                      className="w-full md:w-auto"
                      data-testid="button-search-market"
                    >
                      <TrendingUp className="w-4 h-4 mr-2" />
                      Search Market
                    </Button>

                    <div className="border-t pt-6">
                      <div className="text-center py-12 text-slate-500">
                        <TrendingUp className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                        <h3 className="text-lg font-medium mb-2">Market Insights</h3>
                        <p className="text-sm mb-4">
                          Search for vehicles to see competitive intelligence including:
                        </p>
                        <div className="grid gap-3 md:grid-cols-3 max-w-3xl mx-auto text-left">
                          <div className="flex items-start gap-2">
                            <div className="w-1.5 h-1.5 bg-green-500 rounded-full mt-2" />
                            <div>
                              <div className="font-medium text-slate-700">Price Range</div>
                              <div className="text-xs">Min, max, and average pricing</div>
                            </div>
                          </div>
                          <div className="flex items-start gap-2">
                            <div className="w-1.5 h-1.5 bg-green-500 rounded-full mt-2" />
                            <div>
                              <div className="font-medium text-slate-700">Days in Stock</div>
                              <div className="text-xs">Average time on market</div>
                            </div>
                          </div>
                          <div className="flex items-start gap-2">
                            <div className="w-1.5 h-1.5 bg-green-500 rounded-full mt-2" />
                            <div>
                              <div className="font-medium text-slate-700">Competitor Listings</div>
                              <div className="text-xs">Active inventory nearby</div>
                            </div>
                          </div>
                          <div className="flex items-start gap-2">
                            <div className="w-1.5 h-1.5 bg-green-500 rounded-full mt-2" />
                            <div>
                              <div className="font-medium text-slate-700">Price Trends</div>
                              <div className="text-xs">Historical pricing data</div>
                            </div>
                          </div>
                          <div className="flex items-start gap-2">
                            <div className="w-1.5 h-1.5 bg-green-500 rounded-full mt-2" />
                            <div>
                              <div className="font-medium text-slate-700">Mileage Analysis</div>
                              <div className="text-xs">Odometer vs. price correlation</div>
                            </div>
                          </div>
                          <div className="flex items-start gap-2">
                            <div className="w-1.5 h-1.5 bg-green-500 rounded-full mt-2" />
                            <div>
                              <div className="font-medium text-slate-700">Market Share</div>
                              <div className="text-xs">Inventory distribution</div>
                            </div>
                          </div>
                        </div>
                        <div className="mt-6 p-4 bg-green-50 rounded-lg border border-green-200 max-w-3xl mx-auto">
                          <p className="text-sm text-green-700">
                            <strong>Coming Soon:</strong> Real-time competitor scraping and market analysis
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
