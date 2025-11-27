import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogOut, Search, TrendingUp, Car, ChevronDown, Check, Settings, RefreshCw, X, MessageSquare, Users, Calendar, CalendarCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export default function Manager() {
  const [, setLocation] = useLocation();
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  // VIN state
  const [vin, setVin] = useState("");
  const [vinResults, setVinResults] = useState<any>(null);
  const [isDecoding, setIsDecoding] = useState(false);

  // Manager settings state
  const [settings, setSettings] = useState({
    postalCode: "",
    defaultRadiusKm: 50
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Market pricing state
  const [pricingForm, setPricingForm] = useState({
    selectedYears: [] as number[],
    make: "",
    model: "",
    selectedTrims: [] as string[],
    mileage: "",
    radiusKm: "50"
  });
  const [pricingResults, setPricingResults] = useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isScraping, setIsScraping] = useState(false);

  // Autocomplete data
  const [makes, setMakes] = useState<string[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [trims, setTrims] = useState<string[]>([]);

  // Popover states for autocomplete
  const [yearOpen, setYearOpen] = useState(false);
  const [makeOpen, setMakeOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [trimOpen, setTrimOpen] = useState(false);

  // Metrics state
  const [metrics, setMetrics] = useState({
    totalLeads: 0,
    activeConversations: 0,
    appointmentsBooked: 0,
    scheduledPosts: 0
  });
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(true);

  // Chat prompts state
  const [chatPrompts, setChatPrompts] = useState<any[]>([]);
  const [isLoadingPrompts, setIsLoadingPrompts] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  // Load autocomplete options when form values change
  useEffect(() => {
    if (user) {
      loadMakes();
      loadSettings();
      loadMetrics();
      loadChatPrompts();
    }
  }, [user]);

  useEffect(() => {
    if (pricingForm.make) {
      loadModels(pricingForm.make);
    } else {
      setModels([]);
    }
    // Clear model and trims when make changes
    if (pricingForm.make !== vinResults?.make) {
      setPricingForm(prev => ({ ...prev, model: "", selectedTrims: [] }));
    }
  }, [pricingForm.make]);

  useEffect(() => {
    if (pricingForm.make && pricingForm.model) {
      loadTrims(pricingForm.make, pricingForm.model);
    } else {
      setTrims([]);
    }
    // Clear trims when model changes
    if (pricingForm.model !== vinResults?.model) {
      setPricingForm(prev => ({ ...prev, selectedTrims: [] }));
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
      
      if (parsedUser.role !== 'manager' && parsedUser.role !== 'master') {
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

  const loadSettings = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/manager/settings', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        if (data) {
          setSettings({
            postalCode: data.postalCode || "",
            defaultRadiusKm: data.defaultRadiusKm || 50
          });
          setPricingForm(prev => ({ ...prev, radiusKm: String(data.defaultRadiusKm || 50) }));
        }
      }
    } catch (error) {
      console.error("Error loading settings:", error);
    }
  };

  const loadMetrics = async () => {
    setIsLoadingMetrics(true);
    try {
      const token = localStorage.getItem('auth_token');
      
      const [conversationsRes, queueRes] = await Promise.all([
        fetch('/api/conversations', {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
        fetch('/api/facebook/queue', {
          headers: { 'Authorization': `Bearer ${token}` },
        })
      ]);

      let totalLeads = 0;
      let activeConversations = 0;
      let appointmentsBooked = 0;  // TODO: Implement appointments system
      let scheduledPosts = 0;

      if (conversationsRes.ok) {
        const data = await conversationsRes.json();
        
        // Handle both array (backward compatible) and paginated response format
        let conversationsList: any[] = [];
        if (Array.isArray(data)) {
          conversationsList = data;
        } else if (data && typeof data === 'object') {
          // Check for various response structures
          if (Array.isArray(data.data)) {
            conversationsList = data.data;
          } else if (Array.isArray(data.conversations)) {
            conversationsList = data.conversations;
          }
        }
        
        // Safely get total count
        totalLeads = (data && typeof data === 'object' && typeof data.total === 'number')
          ? data.total
          : conversationsList.length;
        
        // Calculate active conversations (last 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        activeConversations = conversationsList.filter((conv: any) => {
          if (!conv) return false;
          
          // Safely parse timestamp
          const timestamp = conv.lastMessageAt || conv.createdAt;
          if (!timestamp) return false;
          
          const lastMessageDate = new Date(timestamp);
          // Validate date is not Invalid Date
          if (isNaN(lastMessageDate.getTime())) return false;
          
          return lastMessageDate >= sevenDaysAgo;
        }).length;
      }

      if (queueRes.ok) {
        const queueData = await queueRes.json();
        
        // Handle both array and potential object response
        let queueList: any[] = [];
        if (Array.isArray(queueData)) {
          queueList = queueData;
        } else if (queueData && typeof queueData === 'object') {
          if (Array.isArray(queueData.queue)) {
            queueList = queueData.queue;
          } else if (Array.isArray(queueData.data)) {
            queueList = queueData.data;
          }
        }
        
        scheduledPosts = queueList.length;
      }

      setMetrics({
        totalLeads,
        activeConversations,
        appointmentsBooked,
        scheduledPosts
      });
    } catch (error) {
      console.error("Error loading metrics:", error);
    } finally {
      setIsLoadingMetrics(false);
    }
  };

  const loadChatPrompts = async () => {
    setIsLoadingPrompts(true);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/chat-prompts', {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setChatPrompts(data);
      }
    } catch (error) {
      console.error("Error loading chat prompts:", error);
    } finally {
      setIsLoadingPrompts(false);
    }
  };

  const formatScenario = (scenario: string): string => {
    const scenarioMap: { [key: string]: string } = {
      'test-drive': 'Test Drive',
      'get-approved': 'Get Approved',
      'value-trade': 'Value Trade',
      'reserve': 'Reserve',
      'general': 'General'
    };
    return scenarioMap[scenario] || scenario;
  };

  const handleSaveSettings = async () => {
    // Validate postal code (Canadian format: A1A 1A1 or A1A1A1)
    const trimmedPostalCode = settings.postalCode.trim().toUpperCase();
    const canadianPostalCodeRegex = /^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/;
    
    if (!trimmedPostalCode || !canadianPostalCodeRegex.test(trimmedPostalCode)) {
      toast({
        title: "Invalid Postal Code",
        description: "Please enter a valid Canadian postal code (e.g., V6B 5J3)",
        variant: "destructive",
      });
      return;
    }

    setIsSavingSettings(true);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/manager/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...settings,
          postalCode: trimmedPostalCode
        }),
      });

      if (response.ok) {
        setSettings(prev => ({ ...prev, postalCode: trimmedPostalCode }));
        toast({
          title: "Settings Saved",
          description: "Your postal code and default radius have been saved",
        });
        setSettingsOpen(false);
        setPricingForm(prev => ({ ...prev, radiusKm: String(settings.defaultRadiusKm) }));
      } else {
        const error = await response.json();
        toast({
          title: "Save Failed",
          description: error.message || "Unable to save settings",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error saving settings:", error);
      toast({
        title: "Error",
        description: "Failed to save settings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleRefreshMarketData = async () => {
    if (!pricingForm.make || !pricingForm.model) {
      toast({
        title: "Missing Information",
        description: "Please select make and model first",
        variant: "destructive",
      });
      return;
    }

    if (!settings.postalCode || settings.postalCode.trim() === '') {
      toast({
        title: "Settings Required",
        description: "Please configure your postal code in Settings first",
        variant: "destructive",
      });
      setSettingsOpen(true);
      return;
    }

    setIsScraping(true);
    try {
      const token = localStorage.getItem('auth_token');
      
      const currentYear = new Date().getFullYear();
      const years = pricingForm.selectedYears.length > 0 ? pricingForm.selectedYears : [currentYear];
      const yearMin = Math.min(...years);
      const yearMax = Math.max(...years);
      
      const response = await fetch('/api/manager/scrape-market', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          make: pricingForm.make,
          model: pricingForm.model,
          yearMin,
          yearMax,
          postalCode: settings.postalCode.trim(),
          radiusKm: parseInt(pricingForm.radiusKm) || settings.defaultRadiusKm,
          maxResults: 100
        }),
      });

      const result = await response.json();
      
      if (result.error) {
        // Show detailed error breakdown if available
        const errorDetails = result.errors && result.errors.length > 0 
          ? `Errors: ${result.errors.join(', ')}`
          : result.message || "Unable to fetch market data";
        
        toast({
          title: "Market Data Aggregation Failed",
          description: errorDetails,
          variant: "destructive",
        });
      } else {
        // Build detailed success message showing source breakdown
        const sourceBreakdown = [];
        if (result.marketCheckCount > 0) sourceBreakdown.push(`MarketCheck: ${result.marketCheckCount}`);
        if (result.apifyCount > 0) sourceBreakdown.push(`Apify: ${result.apifyCount}`);
        if (result.scraperCount > 0) sourceBreakdown.push(`Scraper: ${result.scraperCount}`);
        
        const successMessage = `Saved ${result.savedCount} new listings${sourceBreakdown.length > 0 ? ` (${sourceBreakdown.join(', ')})` : ''}`;
        
        toast({
          title: "Market Data Refreshed",
          description: successMessage,
        });
        
        // Show warnings if any sources had errors
        if (result.errors && result.errors.length > 0) {
          setTimeout(() => {
            toast({
              title: "Some Data Sources Failed",
              description: result.errors.join(', '),
              variant: "default",
            });
          }, 2000);
        }
        
        // Auto-trigger market analysis after refresh
        setTimeout(() => {
          handleMarketSearch();
        }, 500);
      }
    } catch (error) {
      console.error("Market scraping error:", error);
      toast({
        title: "Error",
        description: "Failed to refresh market data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsScraping(false);
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
        const currentYear = new Date().getFullYear();
        const vehicleYear = result.year || currentYear;
        setPricingForm(prev => ({
          ...prev,
          selectedYears: vehicleYear ? [vehicleYear] : [],
          make: result.make || "",
          model: result.model || "",
          selectedTrims: result.trim ? [result.trim] : [],
          mileage: "",
          // Preserve existing radiusKm (from settings) or use settings default
          radiusKm: prev.radiusKm || String(settings.defaultRadiusKm || 50)
        }));

        toast({
          title: "VIN Decoded Successfully",
          description: `${result.year || ''} ${result.make || ''} ${result.model || ''}`.trim(),
        });

        // Auto-trigger market analysis
        setTimeout(() => {
          if (result.make && result.model) {
            handleMarketSearch();
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

  const handleMarketSearch = async () => {
    if (!pricingForm.make || !pricingForm.model) {
      toast({
        title: "Missing Information",
        description: "Please select make and model to search",
        variant: "destructive",
      });
      return;
    }

    if (!settings.postalCode || settings.postalCode.trim() === '') {
      toast({
        title: "Settings Required",
        description: "Please configure your postal code in Settings first to enable market pricing",
        variant: "destructive",
      });
      setSettingsOpen(true);
      return;
    }

    setIsAnalyzing(true);
    setPricingResults(null);

    try {
      const token = localStorage.getItem('auth_token');
      
      const currentYear = new Date().getFullYear();
      const years = pricingForm.selectedYears.length > 0 ? pricingForm.selectedYears : [currentYear];
      
      const response = await fetch('/api/manager/market-pricing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          make: pricingForm.make,
          model: pricingForm.model,
          years,
          trims: pricingForm.selectedTrims.length > 0 ? pricingForm.selectedTrims : undefined,
          mileage: pricingForm.mileage ? parseInt(pricingForm.mileage) : undefined,
          radiusKm: parseInt(pricingForm.radiusKm) || settings.defaultRadiusKm,
          postalCode: settings.postalCode.trim(),
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
        if (result.totalComps > 0) {
          toast({
            title: "Analysis Complete",
            description: `Found ${result.totalComps} comparable vehicles`,
          });
        } else {
          toast({
            title: "No Results",
            description: result.recommendation || "No comparable vehicles found",
            variant: "default",
          });
        }
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-28 pb-12 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">Sales Manager Dashboard</h1>
              <p className="text-muted-foreground">Welcome back, {user?.name}</p>
            </div>
            <Button onClick={handleLogout} variant="outline" data-testid="button-logout" className="w-full sm:w-auto">
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>

          {/* Metrics Cards */}
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-6">
            <Card data-testid="metric-total-leads">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {isLoadingMetrics ? (
                  <div className="space-y-2">
                    <div className="h-8 w-20 bg-muted rounded animate-pulse" />
                    <div className="h-3 w-32 bg-muted rounded animate-pulse" />
                  </div>
                ) : (
                  <>
                    <div className="text-2xl font-bold" data-testid="value-total-leads">{metrics.totalLeads}</div>
                    <p className="text-xs text-muted-foreground">All chat conversations</p>
                  </>
                )}
              </CardContent>
            </Card>

            <Card data-testid="metric-active-conversations">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Conversations</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {isLoadingMetrics ? (
                  <div className="space-y-2">
                    <div className="h-8 w-20 bg-muted rounded animate-pulse" />
                    <div className="h-3 w-32 bg-muted rounded animate-pulse" />
                  </div>
                ) : (
                  <>
                    <div className="text-2xl font-bold" data-testid="value-active-conversations">{metrics.activeConversations}</div>
                    <p className="text-xs text-muted-foreground">Last 7 days</p>
                  </>
                )}
              </CardContent>
            </Card>

            <Card data-testid="metric-appointments-booked">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Appointments Booked</CardTitle>
                <CalendarCheck className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {isLoadingMetrics ? (
                  <div className="space-y-2">
                    <div className="h-8 w-20 bg-muted rounded animate-pulse" />
                    <div className="h-3 w-32 bg-muted rounded animate-pulse" />
                  </div>
                ) : (
                  <>
                    <div className="text-2xl font-bold" data-testid="value-appointments-booked">{metrics.appointmentsBooked}</div>
                    <p className="text-xs text-muted-foreground">Coming soon</p>
                  </>
                )}
              </CardContent>
            </Card>

            <Card data-testid="metric-scheduled-posts">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Scheduled Posts</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {isLoadingMetrics ? (
                  <div className="space-y-2">
                    <div className="h-8 w-20 bg-muted rounded animate-pulse" />
                    <div className="h-3 w-32 bg-muted rounded animate-pulse" />
                  </div>
                ) : (
                  <>
                    <div className="text-2xl font-bold" data-testid="value-scheduled-posts">{metrics.scheduledPosts}</div>
                    <p className="text-xs text-muted-foreground">In queue</p>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Chat Prompts Card */}
          <Card className="mb-6" data-testid="prompts-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                Chat Prompts (Read-Only)
              </CardTitle>
              <CardDescription>
                View AI chat scenarios configured for your dealership
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingPrompts ? (
                <div className="space-y-2">
                  <div className="h-12 bg-muted rounded animate-pulse" />
                  <div className="h-12 bg-muted rounded animate-pulse" />
                  <div className="h-12 bg-muted rounded animate-pulse" />
                </div>
              ) : chatPrompts.length > 0 ? (
                <Accordion type="single" collapsible>
                  {chatPrompts.map((prompt) => (
                    <AccordionItem 
                      key={prompt.id} 
                      value={prompt.scenario}
                      data-testid={`prompt-${prompt.scenario}`}
                    >
                      <AccordionTrigger className="text-left">
                        {formatScenario(prompt.scenario)}
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                          {prompt.greeting}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageSquare className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                  <p className="text-sm">No chat prompts configured yet</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Settings Card */}
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="w-5 h-5" />
                    Manager Settings
                  </CardTitle>
                  <CardDescription>
                    Configure your location for market pricing searches
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSettingsOpen(!settingsOpen)}
                  data-testid="button-toggle-settings"
                >
                  {settingsOpen ? "Hide Settings" : "Show Settings"}
                </Button>
              </div>
            </CardHeader>
            {settingsOpen && (
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label htmlFor="postal-code">Postal Code *</Label>
                    <Input
                      id="postal-code"
                      placeholder="e.g., V6B 5J3"
                      value={settings.postalCode}
                      onChange={(e) => setSettings({ ...settings, postalCode: e.target.value.toUpperCase() })}
                      data-testid="input-postal-code"
                      className="mt-2"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Used for geocoding and radius-based market searches
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="default-radius">Default Search Radius (KM)</Label>
                    <Input
                      id="default-radius"
                      type="number"
                      value={settings.defaultRadiusKm}
                      onChange={(e) => setSettings({ ...settings, defaultRadiusKm: parseInt(e.target.value) || 50 })}
                      data-testid="input-default-radius"
                      className="mt-2"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Default radius for searching nearby listings
                    </p>
                  </div>
                </div>
                <Button
                  onClick={handleSaveSettings}
                  disabled={isSavingSettings || !settings.postalCode}
                  className="mt-4"
                  data-testid="button-save-settings"
                >
                  {isSavingSettings ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                      Saving...
                    </>
                  ) : (
                    "Save Settings"
                  )}
                </Button>
              </CardContent>
            )}
          </Card>

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
                    <div className="flex flex-col sm:flex-row gap-2 mt-2">
                      <Input
                        id="vin"
                        placeholder="Enter 17-character VIN"
                        value={vin}
                        onChange={(e) => setVin(e.target.value.toUpperCase())}
                        maxLength={17}
                        className="font-mono flex-1"
                        data-testid="input-vin"
                      />
                      <Button 
                        onClick={handleVinDecode}
                        disabled={vin.length !== 17 || isDecoding}
                        data-testid="button-decode-vin"
                        className="w-full sm:w-auto"
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
                    <p className="text-xs text-muted-foreground mt-1">
                      Enter a valid 17-character VIN to decode and auto-populate market analysis
                    </p>
                  </div>
                </div>

                {/* VIN Results */}
                {vinResults && (
                  <div className="border-t pt-6" data-testid="vin-results">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                      <h3 className="text-xl font-bold text-foreground mb-4">
                        {vinResults.year} {vinResults.make} {vinResults.model}
                        {vinResults.trim && ` ${vinResults.trim}`}
                      </h3>
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {vinResults.year && (
                          <div data-testid="result-year">
                            <div className="text-xs text-muted-foreground font-medium">Year</div>
                            <div className="text-sm font-semibold">{vinResults.year}</div>
                          </div>
                        )}
                        {vinResults.make && (
                          <div data-testid="result-make">
                            <div className="text-xs text-muted-foreground font-medium">Make</div>
                            <div className="text-sm font-semibold">{vinResults.make}</div>
                          </div>
                        )}
                        {vinResults.model && (
                          <div data-testid="result-model">
                            <div className="text-xs text-muted-foreground font-medium">Model</div>
                            <div className="text-sm font-semibold">{vinResults.model}</div>
                          </div>
                        )}
                        {vinResults.trim && (
                          <div data-testid="result-trim">
                            <div className="text-xs text-muted-foreground font-medium">Trim</div>
                            <div className="text-sm font-semibold">{vinResults.trim}</div>
                          </div>
                        )}
                        {vinResults.bodyClass && (
                          <div data-testid="result-body-class">
                            <div className="text-xs text-muted-foreground font-medium">Body Class</div>
                            <div className="text-sm font-semibold">{vinResults.bodyClass}</div>
                          </div>
                        )}
                        {vinResults.vehicleType && (
                          <div data-testid="result-vehicle-type">
                            <div className="text-xs text-muted-foreground font-medium">Vehicle Type</div>
                            <div className="text-sm font-semibold">{vinResults.vehicleType}</div>
                          </div>
                        )}
                        {vinResults.fuelType && (
                          <div data-testid="result-fuel-type">
                            <div className="text-xs text-muted-foreground font-medium">Fuel Type</div>
                            <div className="text-sm font-semibold">{vinResults.fuelType}</div>
                          </div>
                        )}
                        {vinResults.transmission && (
                          <div data-testid="result-transmission">
                            <div className="text-xs text-muted-foreground font-medium">Transmission</div>
                            <div className="text-sm font-semibold">{vinResults.transmission}</div>
                          </div>
                        )}
                        {vinResults.driveType && (
                          <div data-testid="result-drive-type">
                            <div className="text-xs text-muted-foreground font-medium">Drive Type</div>
                            <div className="text-sm font-semibold">{vinResults.driveType}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Market Pricing Section */}
                <div className="border-t pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-foreground">Market Pricing Analysis</h3>
                    <Button
                      onClick={handleRefreshMarketData}
                      disabled={isScraping || !pricingForm.make || !pricingForm.model}
                      variant="outline"
                      size="sm"
                      data-testid="button-refresh-market"
                    >
                      {isScraping ? (
                        <>
                          <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin mr-2" />
                          Refreshing...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-3 h-3 mr-2" />
                          Refresh Market Data
                        </>
                      )}
                    </Button>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {/* Year Multi-Select */}
                    <div>
                      <Label>Year (Select Multiple)</Label>
                      <div className="mt-2">
                        <Popover open={yearOpen} onOpenChange={setYearOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={yearOpen}
                              className="w-full justify-between"
                              data-testid="select-year"
                            >
                              <span className="truncate">
                                {pricingForm.selectedYears.length > 0 
                                  ? `${pricingForm.selectedYears.length} year(s) selected`
                                  : "Select years..."}
                              </span>
                              <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[250px] p-0" align="start">
                            <Command>
                              <CommandInput placeholder="Search year..." />
                              <CommandList>
                                <CommandEmpty>No year found.</CommandEmpty>
                                <CommandGroup>
                                  {Array.from({ length: 20 }, (_, i) => new Date().getFullYear() + 1 - i).map((year) => {
                                    const isSelected = pricingForm.selectedYears.includes(year);
                                    return (
                                      <CommandItem
                                        key={year}
                                        value={String(year)}
                                        onSelect={() => {
                                          const newYears = isSelected
                                            ? pricingForm.selectedYears.filter(y => y !== year)
                                            : [...pricingForm.selectedYears, year].sort((a, b) => b - a);
                                          setPricingForm({ ...pricingForm, selectedYears: newYears });
                                        }}
                                        data-testid={`option-year-${year}`}
                                      >
                                        <Check
                                          className={cn(
                                            "mr-2 h-4 w-4",
                                            isSelected ? "opacity-100" : "opacity-0"
                                          )}
                                        />
                                        {year}
                                      </CommandItem>
                                    );
                                  })}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        {pricingForm.selectedYears.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {pricingForm.selectedYears.sort((a, b) => b - a).map((year) => (
                              <Badge
                                key={year}
                                variant="secondary"
                                className="text-xs"
                                data-testid={`badge-year-${year}`}
                              >
                                {year}
                                <X
                                  className="ml-1 h-3 w-3 cursor-pointer"
                                  onClick={() => {
                                    setPricingForm({
                                      ...pricingForm,
                                      selectedYears: pricingForm.selectedYears.filter(y => y !== year)
                                    });
                                  }}
                                />
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
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
                                      setPricingForm({ ...pricingForm, make, model: "", selectedTrims: [] });
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
                                      setPricingForm({ ...pricingForm, model, selectedTrims: [] });
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

                    {/* Trim Multi-Select */}
                    <div className="md:col-span-3">
                      <Label>Trims (Optional - Select Multiple)</Label>
                      <div className="mt-2">
                        <Popover open={trimOpen} onOpenChange={setTrimOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={trimOpen}
                              className="w-full justify-between"
                              disabled={!pricingForm.model}
                              data-testid="select-trim"
                            >
                              <span className="truncate">
                                {pricingForm.selectedTrims.length > 0 
                                  ? `${pricingForm.selectedTrims.length} trim(s) selected`
                                  : "Select trims..."}
                              </span>
                              <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[400px] p-0">
                            <Command>
                              <CommandInput placeholder="Search trim..." />
                              <CommandList>
                                <CommandEmpty>No trim found.</CommandEmpty>
                                <CommandGroup>
                                  {trims.map((trim) => {
                                    const isSelected = pricingForm.selectedTrims.includes(trim);
                                    return (
                                      <CommandItem
                                        key={trim}
                                        value={trim}
                                        onSelect={() => {
                                          const newTrims = isSelected
                                            ? pricingForm.selectedTrims.filter(t => t !== trim)
                                            : [...pricingForm.selectedTrims, trim];
                                          setPricingForm({ ...pricingForm, selectedTrims: newTrims });
                                        }}
                                        data-testid={`option-trim-${trim.toLowerCase().replace(/\s+/g, '-')}`}
                                      >
                                        <Check
                                          className={cn(
                                            "mr-2 h-4 w-4",
                                            isSelected ? "opacity-100" : "opacity-0"
                                          )}
                                        />
                                        {trim}
                                      </CommandItem>
                                    );
                                  })}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        {/* Selected trims badges */}
                        {pricingForm.selectedTrims.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {pricingForm.selectedTrims.map((trim) => (
                              <Badge
                                key={trim}
                                variant="secondary"
                                className="gap-1"
                                data-testid={`badge-trim-${trim.toLowerCase().replace(/\s+/g, '-')}`}
                              >
                                {trim}
                                <X
                                  className="w-3 h-3 cursor-pointer hover:text-destructive"
                                  onClick={() => {
                                    setPricingForm({
                                      ...pricingForm,
                                      selectedTrims: pricingForm.selectedTrims.filter(t => t !== trim)
                                    });
                                  }}
                                />
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
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
                      <Label htmlFor="radius-km">Search Radius (KM)</Label>
                      <Input
                        id="radius-km"
                        type="number"
                        value={pricingForm.radiusKm}
                        onChange={(e) => setPricingForm({ ...pricingForm, radiusKm: e.target.value })}
                        data-testid="input-radius"
                        className="mt-2"
                      />
                    </div>
                  </div>

                  <Button 
                    onClick={handleMarketSearch} 
                    className="w-full md:w-auto mt-6"
                    disabled={isAnalyzing || !pricingForm.make || !pricingForm.model}
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
                      {/* Data Source Info */}
                      {pricingResults.meta && (
                        <div className="bg-muted border border-border rounded-lg p-4">
                          <div className="space-y-3">
                            {/* Primary metadata row */}
                            <div className="flex flex-wrap items-center gap-4 text-sm">
                              <div>
                                <span className="font-medium text-foreground">Data Source:</span>{' '}
                                <span className="text-foreground">{pricingResults.meta.dataSource === 'external_market' ? 'External Market Listings' : 'No Data'}</span>
                              </div>
                              {pricingResults.meta.year && (
                                <div>
                                  <span className="font-medium text-foreground">Year:</span>{' '}
                                  <span className="text-foreground">{pricingResults.meta.year}</span>
                                </div>
                              )}
                              {pricingResults.meta.searchRadius && (
                                <div>
                                  <span className="font-medium text-foreground">Search Radius:</span>{' '}
                                  <span className="text-foreground">{pricingResults.meta.searchRadius} KM</span>
                                </div>
                              )}
                              {pricingResults.meta.postalCode && (
                                <div>
                                  <span className="font-medium text-foreground">Location:</span>{' '}
                                  <span className="text-foreground">{pricingResults.meta.postalCode}</span>
                                </div>
                              )}
                            </div>
                            
                            {/* Source breakdown badges */}
                            {pricingResults.meta.sourceBreakdown && (
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-medium text-foreground">Data Sources:</span>
                                {pricingResults.meta.sourceBreakdown.marketcheck > 0 && (
                                  <Badge variant="default" className="bg-green-600 hover:bg-green-700">
                                    MarketCheck: {pricingResults.meta.sourceBreakdown.marketcheck}
                                  </Badge>
                                )}
                                {pricingResults.meta.sourceBreakdown.apify > 0 && (
                                  <Badge variant="default" className="bg-blue-600 hover:bg-blue-700">
                                    Apify: {pricingResults.meta.sourceBreakdown.apify}
                                  </Badge>
                                )}
                                {pricingResults.meta.sourceBreakdown.autotrader_scraper > 0 && (
                                  <Badge variant="outline" className="border-border">
                                    Scraper: {pricingResults.meta.sourceBreakdown.autotrader_scraper}
                                  </Badge>
                                )}
                                {pricingResults.meta.totalListings > 0 && (
                                  <Badge variant="secondary" className="ml-2">
                                    Total: {pricingResults.meta.totalListings}
                                  </Badge>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Market Statistics */}
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                        <h3 className="text-xl font-bold text-foreground mb-4">
                          Market Analysis: {pricingForm.make} {pricingForm.model}
                          {pricingForm.selectedTrims.length > 0 && ` - ${pricingForm.selectedTrims.join(', ')}`}
                        </h3>
                        <div className="grid gap-4 md:grid-cols-4">
                          <div data-testid="stat-average-price">
                            <div className="text-xs text-muted-foreground font-medium">Average Price</div>
                            <div className="text-2xl font-bold text-green-600">
                              ${pricingResults.averagePrice.toLocaleString()}
                            </div>
                          </div>
                          <div data-testid="stat-median-price">
                            <div className="text-xs text-muted-foreground font-medium">Median Price</div>
                            <div className="text-2xl font-bold">${pricingResults.medianPrice.toLocaleString()}</div>
                          </div>
                          <div data-testid="stat-price-range">
                            <div className="text-xs text-muted-foreground font-medium">Price Range</div>
                            <div className="text-lg font-semibold">
                              ${pricingResults.minPrice.toLocaleString()} - ${pricingResults.maxPrice.toLocaleString()}
                            </div>
                          </div>
                          <div data-testid="stat-total-comps">
                            <div className="text-xs text-muted-foreground font-medium">Comparables Found</div>
                            <div className="text-2xl font-bold">{pricingResults.totalComps}</div>
                          </div>
                        </div>
                      </div>

                      {/* Recommendation */}
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <h4 className="font-semibold text-foreground mb-2">Market Recommendation</h4>
                        <p className="text-sm text-foreground">{pricingResults.recommendation}</p>
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
                          <h4 className="font-semibold text-foreground mb-4">Comparable Vehicles</h4>
                          <div className="space-y-3">
                            {pricingResults.comparisons.slice(0, 10).map((comp: any, index: number) => (
                              <div 
                                key={index}
                                className="border rounded-lg p-4 hover:bg-muted"
                                data-testid={`comparison-${index}`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex-1">
                                    <div className="font-medium">
                                      {comp.year} {comp.make} {comp.model}
                                      {comp.trim && ` ${comp.trim}`}
                                    </div>
                                    <div className="text-sm text-muted-foreground mt-1">
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
                    <div className="text-center py-12 text-muted-foreground">
                      <Car className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
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
