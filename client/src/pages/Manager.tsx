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

  const handleVinDecode = () => {
    toast({
      title: "Coming Soon",
      description: "VIN decoder API integration will be available soon",
    });
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
                            disabled={vin.length !== 17}
                            data-testid="button-decode-vin"
                          >
                            <Search className="w-4 h-4 mr-2" />
                            Decode
                          </Button>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          Enter a valid 17-character VIN to retrieve vehicle details
                        </p>
                      </div>
                    </div>

                    <div className="border-t pt-6">
                      <div className="text-center py-12 text-slate-500">
                        <Car className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                        <h3 className="text-lg font-medium mb-2">VIN Decoder Results</h3>
                        <p className="text-sm mb-4">
                          Enter a VIN above to see detailed vehicle information including:
                        </p>
                        <div className="grid gap-3 md:grid-cols-2 max-w-2xl mx-auto text-left">
                          <div className="flex items-start gap-2">
                            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2" />
                            <div>
                              <div className="font-medium text-slate-700">Make, Model & Trim</div>
                              <div className="text-xs">Complete vehicle identification</div>
                            </div>
                          </div>
                          <div className="flex items-start gap-2">
                            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2" />
                            <div>
                              <div className="font-medium text-slate-700">Engine & Transmission</div>
                              <div className="text-xs">Powertrain specifications</div>
                            </div>
                          </div>
                          <div className="flex items-start gap-2">
                            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2" />
                            <div>
                              <div className="font-medium text-slate-700">Factory Options</div>
                              <div className="text-xs">Installed features and packages</div>
                            </div>
                          </div>
                          <div className="flex items-start gap-2">
                            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2" />
                            <div>
                              <div className="font-medium text-slate-700">Market Value</div>
                              <div className="text-xs">Estimated pricing data</div>
                            </div>
                          </div>
                        </div>
                        <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200 max-w-2xl mx-auto">
                          <p className="text-sm text-blue-700">
                            <strong>Coming Soon:</strong> VIN decoder API integration with real-time data
                          </p>
                        </div>
                      </div>
                    </div>
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
