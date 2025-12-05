import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogOut, Search, TrendingUp, Car, ChevronDown, Check, Settings, RefreshCw, X, MessageSquare, Users, Calendar, CalendarCheck, ClipboardCheck, BarChart3, Bot, Clock, Sparkles, Pencil, Save, TrendingDown, Minus, ArrowUp, ArrowDown, PackageOpen, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { InventoryManagement } from "@/components/InventoryManagement";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Progress } from "@/components/ui/progress";

// Inventory Analysis Tab Component
function InventoryAnalysisTab() {
  const { toast } = useToast();
  const [selectedRadius, setSelectedRadius] = useState<string>('50');
  const [inventoryData, setInventoryData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const radiusOptions = [
    { value: '50', label: '50 km' },
    { value: '250', label: '250 km' },
    { value: '1000', label: '1,000 km' },
    { value: 'national', label: 'National' }
  ];

  const fetchInventoryAnalysis = async (radius: string) => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/manager/inventory-analysis?radiusKm=${radius}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setInventoryData(data);
      } else {
        throw new Error('Failed to fetch inventory analysis');
      }
    } catch (error) {
      console.error('Error fetching inventory analysis:', error);
      toast({
        title: "Error",
        description: "Failed to load inventory analysis",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/manager/inventory-analysis/refresh', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ radiusKm: selectedRadius === 'national' ? 2000 : parseInt(selectedRadius) })
      });
      
      if (response.ok) {
        const result = await response.json();
        toast({
          title: "Analysis Complete",
          description: `Analyzed ${result.vehiclesAnalyzed} vehicle types, found ${result.newListingsFound} new market listings`
        });
        // Reload the data
        await fetchInventoryAnalysis(selectedRadius);
      } else {
        throw new Error('Failed to refresh analysis');
      }
    } catch (error) {
      console.error('Error refreshing analysis:', error);
      toast({
        title: "Error",
        description: "Failed to refresh market data",
        variant: "destructive"
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchInventoryAnalysis(selectedRadius);
  }, [selectedRadius]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(value);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr);
    return date.toLocaleString('en-CA', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getPriceComparisonColor = (comparison: string | null) => {
    switch (comparison) {
      case 'below_market': return 'text-green-600 bg-green-100';
      case 'at_market': return 'text-blue-600 bg-blue-100';
      case 'above_market': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getPriceComparisonLabel = (comparison: string | null) => {
    switch (comparison) {
      case 'below_market': return 'Below Market';
      case 'at_market': return 'At Market';
      case 'above_market': return 'Above Market';
      default: return 'No Data';
    }
  };

  return (
    <div data-testid="tab-content-inventory" className="space-y-6">
      {/* Header with controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-lg font-semibold">Inventory Market Analysis</h3>
          <p className="text-sm text-muted-foreground">
            Compare your vehicles against market pricing
            {inventoryData?.lastUpdated && (
              <span className="ml-2 text-xs">
                • Updated {formatDate(inventoryData.lastUpdated)}
              </span>
            )}
          </p>
        </div>
        
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Select value={selectedRadius} onValueChange={setSelectedRadius}>
            <SelectTrigger className="w-[140px]" data-testid="radius-selector">
              <SelectValue placeholder="Distance" />
            </SelectTrigger>
            <SelectContent>
              {radiusOptions.map(opt => (
                <SelectItem key={opt.value} value={opt.value} data-testid={`radius-${opt.value}`}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Button 
            onClick={handleRefresh}
            disabled={isRefreshing}
            data-testid="analyze-button"
            className="flex-1 sm:flex-none"
          >
            {isRefreshing ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Analyze
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Loading state */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-muted rounded animate-pulse" />
          ))}
        </div>
      ) : inventoryData?.vehicles?.length > 0 ? (
        <div className="space-y-4">
          {/* Summary stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold">{inventoryData.totalVehicles}</div>
                <div className="text-xs text-muted-foreground">Total Vehicles</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-green-600">
                  {inventoryData.vehicles.filter((v: any) => v.priceComparison === 'below_market').length}
                </div>
                <div className="text-xs text-muted-foreground">Below Market</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-blue-600">
                  {inventoryData.vehicles.filter((v: any) => v.priceComparison === 'at_market').length}
                </div>
                <div className="text-xs text-muted-foreground">At Market</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-red-600">
                  {inventoryData.vehicles.filter((v: any) => v.priceComparison === 'above_market').length}
                </div>
                <div className="text-xs text-muted-foreground">Above Market</div>
              </CardContent>
            </Card>
          </div>

          {/* Vehicle list */}
          <div className="space-y-3">
            {inventoryData.vehicles.map((vehicle: any) => (
              <Card key={vehicle.id} data-testid={`vehicle-card-${vehicle.id}`}>
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row justify-between gap-4">
                    {/* Vehicle info */}
                    <div className="flex gap-4">
                      {vehicle.imageUrl && (
                        <img 
                          src={vehicle.imageUrl} 
                          alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
                          className="w-24 h-18 object-cover rounded"
                        />
                      )}
                      <div>
                        <h4 className="font-semibold">
                          {vehicle.year} {vehicle.make} {vehicle.model}
                        </h4>
                        {vehicle.trim && (
                          <p className="text-sm text-muted-foreground">{vehicle.trim}</p>
                        )}
                        <p className="text-lg font-bold mt-1">
                          {vehicle.price ? formatCurrency(vehicle.price) : 'No Price'}
                        </p>
                        {vehicle.mileage && (
                          <p className="text-xs text-muted-foreground">
                            {vehicle.mileage.toLocaleString()} km
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Market comparison */}
                    <div className="flex flex-col items-end gap-2 min-w-[200px]">
                      <Badge className={cn("text-xs", getPriceComparisonColor(vehicle.priceComparison))}>
                        {getPriceComparisonLabel(vehicle.priceComparison)}
                      </Badge>
                      
                      {vehicle.marketData ? (
                        <div className="text-right">
                          <div className="text-sm">
                            <span className="text-muted-foreground">Market Avg: </span>
                            <span className="font-medium">{formatCurrency(vehicle.marketData.avgPrice)}</span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {vehicle.marketData.totalListings} listings • {formatCurrency(vehicle.marketData.minPrice)} - {formatCurrency(vehicle.marketData.maxPrice)}
                          </div>
                          {vehicle.percentilePosition !== null && (
                            <div className="mt-2">
                              <div className="text-xs text-muted-foreground mb-1">
                                Price Percentile: {vehicle.percentilePosition}%
                              </div>
                              <Progress value={vehicle.percentilePosition} className="h-2 w-32" />
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground">
                          No market data available
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          <Car className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-medium mb-2">No Vehicles Found</h3>
          <p className="text-sm">
            Your inventory is empty. Add vehicles to see market analysis.
          </p>
        </div>
      )}
    </div>
  );
}

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
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [activeManagerTab, setActiveManagerTab] = useState<'appraisal' | 'inventory' | 'my-inventory' | 'conversations' | 'prompts' | 'settings'>('appraisal');

  // Conversations state
  const [allConversations, setAllConversations] = useState<{
    websiteChats: any[];
    messengerConversations: any[];
    totalWebsiteChats: number;
    totalMessengerConversations: number;
  } | null>(null);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);

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
  const [enhancedResults, setEnhancedResults] = useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isScraping, setIsScraping] = useState(false);
  const [showEnhancedView, setShowEnhancedView] = useState(true);

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
  const [editingPromptId, setEditingPromptId] = useState<number | null>(null);
  const [editedPrompt, setEditedPrompt] = useState<{ greeting: string; systemPrompt: string }>({ greeting: '', systemPrompt: '' });
  const [isSavingPrompt, setIsSavingPrompt] = useState(false);

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

  // Load conversations when tab is selected
  useEffect(() => {
    if (activeManagerTab === 'conversations' && user && !allConversations) {
      loadConversations();
    }
  }, [activeManagerTab, user]);

  const loadConversations = async () => {
    setIsLoadingConversations(true);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/all-conversations', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setAllConversations(data);
      }
    } catch (error) {
      console.error('Error loading conversations:', error);
      toast({
        title: "Error",
        description: "Failed to load conversations",
        variant: "destructive"
      });
    } finally {
      setIsLoadingConversations(false);
    }
  };

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

  const startEditingPrompt = (prompt: any) => {
    setEditingPromptId(prompt.id);
    setEditedPrompt({
      greeting: prompt.greeting,
      systemPrompt: prompt.systemPrompt
    });
  };

  const cancelEditingPrompt = () => {
    setEditingPromptId(null);
    setEditedPrompt({ greeting: '', systemPrompt: '' });
  };

  const savePrompt = async (prompt: any) => {
    setIsSavingPrompt(true);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/chat-prompts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          scenario: prompt.scenario,
          greeting: editedPrompt.greeting,
          systemPrompt: editedPrompt.systemPrompt
        })
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Chat prompt saved successfully",
        });
        setEditingPromptId(null);
        setEditedPrompt({ greeting: '', systemPrompt: '' });
        loadChatPrompts();
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.error || "Failed to save prompt",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error saving chat prompt:", error);
      toast({
        title: "Error",
        description: "Failed to save prompt",
        variant: "destructive",
      });
    } finally {
      setIsSavingPrompt(false);
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
      setActiveManagerTab('settings');
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
      setActiveManagerTab('settings');
      return;
    }

    setIsAnalyzing(true);
    setPricingResults(null);
    setEnhancedResults(null);

    try {
      const token = localStorage.getItem('auth_token');
      
      const currentYear = new Date().getFullYear();
      const years = pricingForm.selectedYears.length > 0 ? pricingForm.selectedYears : [currentYear];
      
      // Call enhanced market analysis API for comprehensive data
      const enhancedResponse = await fetch('/api/manager/enhanced-market-analysis', {
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

      if (!enhancedResponse.ok) {
        throw new Error(`Server error: ${enhancedResponse.status}`);
      }
      
      const enhancedResult = await enhancedResponse.json();
      
      if (enhancedResult.error) {
        toast({
          title: "Analysis Failed",
          description: enhancedResult.message || "Unable to analyze market pricing",
          variant: "destructive",
        });
      } else {
        setEnhancedResults(enhancedResult);
        
        // Build legacy pricingResults for backward compatibility with proper defaults
        const summary = enhancedResult.summary || {};
        const priceRec = enhancedResult.priceRecommendation || {};
        const sourceBreakdown: Record<string, number> = {};
        
        // Build source breakdown from sources array
        if (enhancedResult.sources && Array.isArray(enhancedResult.sources)) {
          enhancedResult.sources.forEach((src: string) => {
            sourceBreakdown[src] = (sourceBreakdown[src] || 0) + 1;
          });
        }
        
        // Count listings by source from comparisons if available
        if (enhancedResult.comparisons && Array.isArray(enhancedResult.comparisons)) {
          enhancedResult.comparisons.forEach((comp: any) => {
            const source = comp.source || 'unknown';
            sourceBreakdown[source] = (sourceBreakdown[source] || 0) + 1;
          });
        }
        
        setPricingResults({
          averagePrice: summary.averagePrice || 0,
          medianPrice: summary.medianPrice || 0,
          minPrice: summary.minPrice || 0,
          maxPrice: summary.maxPrice || 0,
          totalComps: summary.totalListings || 0,
          priceRange: priceRec.priceRange || { low: summary.minPrice || 0, high: summary.maxPrice || 0 },
          recommendation: priceRec.reasoning || 'Market analysis complete. Review the price percentiles for optimal pricing.',
          comparisons: enhancedResult.comparisons || [],
          meta: {
            dataSource: 'external_market',
            totalListings: summary.totalListings || 0,
            sourceBreakdown,
            searchRadius: enhancedResult.searchParams?.radiusKm || parseInt(pricingForm.radiusKm),
            postalCode: enhancedResult.searchParams?.location || settings.postalCode,
            year: enhancedResult.searchParams?.years?.[0] || new Date().getFullYear()
          }
        });
        
        if (summary.totalListings > 0) {
          toast({
            title: "Analysis Complete",
            description: `Found ${summary.totalListings} comparable vehicles from ${enhancedResult.sources?.length || 1} source(s)`,
          });
        } else {
          toast({
            title: "No Results",
            description: "No comparable vehicles found. Try expanding your search criteria.",
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
            <div className="flex flex-col sm:flex-row gap-2">
              <Button 
                onClick={() => window.open('/', '_blank')} 
                variant="outline" 
                data-testid="button-website-view" 
                className="w-full sm:w-auto"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Website View
              </Button>
              <Button onClick={handleLogout} variant="outline" data-testid="button-logout" className="w-full sm:w-auto">
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
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

          {/* Manager Settings with Tabs */}
          <Card className="mb-6" data-testid="manager-settings-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Manager Settings
              </CardTitle>
              <CardDescription>
                Vehicle appraisal, inventory analysis, chat prompts, and configuration
              </CardDescription>
              <div className="flex flex-wrap gap-2 pt-4">
                <Button
                  variant={activeManagerTab === 'appraisal' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveManagerTab('appraisal')}
                  data-testid="tab-vehicle-appraisal"
                  className="flex items-center gap-2"
                >
                  <ClipboardCheck className="w-4 h-4" />
                  Vehicle Appraisal
                </Button>
                <Button
                  variant={activeManagerTab === 'inventory' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveManagerTab('inventory')}
                  data-testid="tab-inventory-analysis"
                  className="flex items-center gap-2"
                >
                  <BarChart3 className="w-4 h-4" />
                  Inventory Analysis
                </Button>
                <Button
                  variant={activeManagerTab === 'my-inventory' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveManagerTab('my-inventory')}
                  data-testid="tab-my-inventory"
                  className="flex items-center gap-2 bg-emerald-600/10 hover:bg-emerald-600/20"
                >
                  <PackageOpen className="w-4 h-4 text-emerald-600" />
                  <span className="text-emerald-600 font-medium">My Inventory</span>
                </Button>
                <Button
                  variant={activeManagerTab === 'conversations' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveManagerTab('conversations')}
                  data-testid="tab-conversations"
                  className="flex items-center gap-2"
                >
                  <MessageSquare className="w-4 h-4" />
                  Conversations
                </Button>
                <Button
                  variant={activeManagerTab === 'prompts' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveManagerTab('prompts')}
                  data-testid="tab-ai-chat-prompts"
                  className="flex items-center gap-2"
                >
                  <Bot className="w-4 h-4" />
                  AI Chat Prompts
                </Button>
                <Button
                  variant={activeManagerTab === 'settings' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveManagerTab('settings')}
                  data-testid="tab-settings"
                  className="flex items-center gap-2"
                >
                  <Settings className="w-4 h-4" />
                  Settings
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Vehicle Appraisal Tab */}
              {activeManagerTab === 'appraisal' && (
                <div className="space-y-8" data-testid="tab-content-appraisal">
                  <div>
                    <h3 className="text-lg font-semibold mb-4">VIN Decoder & Market Pricing Analysis</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Decode VINs to get vehicle specifications and automatic market pricing analysis
                    </p>
                  </div>
                  
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
                      <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg p-6">
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
                                data-testid="select-years"
                              >
                                {pricingForm.selectedYears.length > 0 
                                  ? `${pricingForm.selectedYears.length} year(s) selected`
                                  : "Select years"}
                                <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[200px] p-0">
                              <Command>
                                <CommandInput placeholder="Search year..." />
                                <CommandList>
                                  <CommandEmpty>No year found.</CommandEmpty>
                                  <CommandGroup>
                                    {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() + 1 - i).map((year) => (
                                      <CommandItem
                                        key={year}
                                        value={String(year)}
                                        onSelect={() => {
                                          setPricingForm(prev => ({
                                            ...prev,
                                            selectedYears: prev.selectedYears.includes(year)
                                              ? prev.selectedYears.filter(y => y !== year)
                                              : [...prev.selectedYears, year].sort((a, b) => b - a)
                                          }));
                                        }}
                                      >
                                        <Check
                                          className={cn(
                                            "mr-2 h-4 w-4",
                                            pricingForm.selectedYears.includes(year) ? "opacity-100" : "opacity-0"
                                          )}
                                        />
                                        {year}
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        </div>
                      </div>

                      {/* Make Select */}
                      <div>
                        <Label>Make</Label>
                        <div className="mt-2">
                          <Popover open={makeOpen} onOpenChange={setMakeOpen}>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={makeOpen}
                                className="w-full justify-between"
                                data-testid="select-make"
                              >
                                {pricingForm.make || "Select make"}
                                <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[200px] p-0">
                              <Command>
                                <CommandInput placeholder="Search make..." />
                                <CommandList>
                                  <CommandEmpty>No make found.</CommandEmpty>
                                  <CommandGroup>
                                    {makes.map((make) => (
                                      <CommandItem
                                        key={make}
                                        value={make}
                                        onSelect={(value) => {
                                          setPricingForm(prev => ({ ...prev, make: value }));
                                          setMakeOpen(false);
                                        }}
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
                      </div>

                      {/* Model Select */}
                      <div>
                        <Label>Model</Label>
                        <div className="mt-2">
                          <Popover open={modelOpen} onOpenChange={setModelOpen}>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={modelOpen}
                                className="w-full justify-between"
                                disabled={!pricingForm.make}
                                data-testid="select-model"
                              >
                                {pricingForm.model || "Select model"}
                                <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[200px] p-0">
                              <Command>
                                <CommandInput placeholder="Search model..." />
                                <CommandList>
                                  <CommandEmpty>No model found.</CommandEmpty>
                                  <CommandGroup>
                                    {models.map((model) => (
                                      <CommandItem
                                        key={model}
                                        value={model}
                                        onSelect={(value) => {
                                          setPricingForm(prev => ({ ...prev, model: value }));
                                          setModelOpen(false);
                                        }}
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
                      </div>

                      {/* Trim Multi-Select */}
                      <div>
                        <Label>Trim (Select Multiple)</Label>
                        <div className="mt-2">
                          <Popover open={trimOpen} onOpenChange={setTrimOpen}>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={trimOpen}
                                className="w-full justify-between"
                                disabled={!pricingForm.model}
                                data-testid="select-trims"
                              >
                                {pricingForm.selectedTrims.length > 0 
                                  ? `${pricingForm.selectedTrims.length} trim(s) selected`
                                  : "Select trims (optional)"}
                                <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[200px] p-0">
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
                                          setPricingForm(prev => ({
                                            ...prev,
                                            selectedTrims: prev.selectedTrims.includes(trim)
                                              ? prev.selectedTrims.filter(t => t !== trim)
                                              : [...prev.selectedTrims, trim]
                                          }));
                                        }}
                                      >
                                        <Check
                                          className={cn(
                                            "mr-2 h-4 w-4",
                                            pricingForm.selectedTrims.includes(trim) ? "opacity-100" : "opacity-0"
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
                      </div>

                      {/* Mileage */}
                      <div>
                        <Label htmlFor="mileage">Mileage (Optional)</Label>
                        <Input
                          id="mileage"
                          type="number"
                          placeholder="e.g., 50000"
                          value={pricingForm.mileage}
                          onChange={(e) => setPricingForm(prev => ({ ...prev, mileage: e.target.value }))}
                          data-testid="input-mileage"
                          className="mt-2"
                        />
                      </div>

                      {/* Radius */}
                      <div>
                        <Label htmlFor="radius">Search Radius (KM)</Label>
                        <Select
                          value={pricingForm.radiusKm}
                          onValueChange={(value) => setPricingForm(prev => ({ ...prev, radiusKm: value }))}
                        >
                          <SelectTrigger className="mt-2" data-testid="select-radius">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="25">25 km</SelectItem>
                            <SelectItem value="50">50 km</SelectItem>
                            <SelectItem value="100">100 km</SelectItem>
                            <SelectItem value="200">200 km</SelectItem>
                            <SelectItem value="500">500 km</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <Button
                      onClick={handleMarketSearch}
                      disabled={isAnalyzing || !pricingForm.make || !pricingForm.model}
                      className="mt-4"
                      data-testid="button-analyze-pricing"
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
                        <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg p-6">
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
                        <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900 rounded-lg p-4">
                          <h4 className="font-semibold text-foreground mb-2">Market Recommendation</h4>
                          <p className="text-sm text-foreground">{pricingResults.recommendation}</p>
                          <div className="mt-3 text-sm">
                            <span className="font-medium">Recommended Price Range:</span>{' '}
                            <span className="font-semibold text-green-600">
                              ${pricingResults.priceRange.low.toLocaleString()} - ${pricingResults.priceRange.high.toLocaleString()}
                            </span>
                          </div>
                        </div>

                        {/* Enhanced Analysis Section */}
                        {enhancedResults && showEnhancedView && (
                          <>
                            {/* Price Percentile Breakdown */}
                            {enhancedResults.percentiles && Object.keys(enhancedResults.percentiles).length > 0 && (
                              <div className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950/20 dark:to-indigo-950/20 border border-purple-200 dark:border-purple-900 rounded-lg p-6">
                                <h4 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                                  <BarChart3 className="w-5 h-5" />
                                  Price Distribution Percentiles
                                </h4>
                                <div className="grid gap-3 md:grid-cols-5">
                                  <div className="text-center p-3 bg-white/50 dark:bg-black/20 rounded-lg">
                                    <div className="text-xs text-muted-foreground font-medium">10th Percentile</div>
                                    <div className="text-lg font-bold text-green-600">${enhancedResults.percentiles.p10?.toLocaleString()}</div>
                                    <div className="text-xs text-muted-foreground">Low Range</div>
                                  </div>
                                  <div className="text-center p-3 bg-white/50 dark:bg-black/20 rounded-lg">
                                    <div className="text-xs text-muted-foreground font-medium">25th Percentile</div>
                                    <div className="text-lg font-bold text-blue-600">${enhancedResults.percentiles.p25?.toLocaleString()}</div>
                                    <div className="text-xs text-muted-foreground">Competitive</div>
                                  </div>
                                  <div className="text-center p-3 bg-white/50 dark:bg-black/20 rounded-lg border-2 border-primary">
                                    <div className="text-xs text-muted-foreground font-medium">50th (Median)</div>
                                    <div className="text-xl font-bold text-primary">${enhancedResults.percentiles.p50?.toLocaleString()}</div>
                                    <div className="text-xs text-muted-foreground">Market Center</div>
                                  </div>
                                  <div className="text-center p-3 bg-white/50 dark:bg-black/20 rounded-lg">
                                    <div className="text-xs text-muted-foreground font-medium">75th Percentile</div>
                                    <div className="text-lg font-bold text-orange-600">${enhancedResults.percentiles.p75?.toLocaleString()}</div>
                                    <div className="text-xs text-muted-foreground">Premium</div>
                                  </div>
                                  <div className="text-center p-3 bg-white/50 dark:bg-black/20 rounded-lg">
                                    <div className="text-xs text-muted-foreground font-medium">90th Percentile</div>
                                    <div className="text-lg font-bold text-red-600">${enhancedResults.percentiles.p90?.toLocaleString()}</div>
                                    <div className="text-xs text-muted-foreground">High Range</div>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Days on Market Analysis */}
                            {enhancedResults.daysOnMarket && enhancedResults.daysOnMarket.average > 0 && (
                              <div className="bg-gradient-to-r from-teal-50 to-cyan-50 dark:from-teal-950/20 dark:to-cyan-950/20 border border-teal-200 dark:border-teal-900 rounded-lg p-6">
                                <h4 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                                  <Clock className="w-5 h-5" />
                                  Days on Market Analysis
                                </h4>
                                <div className="grid gap-4 md:grid-cols-4">
                                  <div className="text-center">
                                    <div className="text-3xl font-bold text-teal-600">{enhancedResults.daysOnMarket.average}</div>
                                    <div className="text-xs text-muted-foreground">Average Days</div>
                                  </div>
                                  <div className="text-center">
                                    <div className="text-3xl font-bold">{enhancedResults.daysOnMarket.median}</div>
                                    <div className="text-xs text-muted-foreground">Median Days</div>
                                  </div>
                                  <div className="text-center">
                                    <div className="text-3xl font-bold text-green-600">{enhancedResults.daysOnMarket.fastest}</div>
                                    <div className="text-xs text-muted-foreground">Fastest Sale</div>
                                  </div>
                                  <div className="text-center">
                                    <div className="text-3xl font-bold text-red-600">{enhancedResults.daysOnMarket.slowest}</div>
                                    <div className="text-xs text-muted-foreground">Slowest Sale</div>
                                  </div>
                                </div>
                                {enhancedResults.daysOnMarket.distribution && (
                                  <div className="mt-4 pt-4 border-t border-teal-200 dark:border-teal-800">
                                    <div className="text-sm text-muted-foreground mb-2">Sell-Through Distribution:</div>
                                    <div className="flex gap-4 flex-wrap text-sm">
                                      <span className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 px-2 py-1 rounded">
                                        &lt;7 days: {enhancedResults.daysOnMarket.distribution.under7Days}
                                      </span>
                                      <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 px-2 py-1 rounded">
                                        &lt;14 days: {enhancedResults.daysOnMarket.distribution.under14Days}
                                      </span>
                                      <span className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 px-2 py-1 rounded">
                                        &lt;30 days: {enhancedResults.daysOnMarket.distribution.under30Days}
                                      </span>
                                      <span className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 px-2 py-1 rounded">
                                        30+ days: {enhancedResults.daysOnMarket.distribution.over30Days}
                                      </span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Competitor Dealers */}
                            {enhancedResults.competitors && enhancedResults.competitors.length > 0 && (
                              <div className="bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20 border border-orange-200 dark:border-orange-900 rounded-lg p-6">
                                <h4 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                                  <Users className="w-5 h-5" />
                                  Competitor Dealer Radar ({enhancedResults.competitors.length} dealers)
                                </h4>
                                <div className="overflow-x-auto">
                                  <table className="w-full text-sm">
                                    <thead>
                                      <tr className="text-left border-b border-orange-200 dark:border-orange-800">
                                        <th className="pb-2 font-medium">Dealer Name</th>
                                        <th className="pb-2 font-medium text-center">Listings</th>
                                        <th className="pb-2 font-medium text-right">Avg Price</th>
                                        <th className="pb-2 font-medium text-right">Price Range</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {enhancedResults.competitors.slice(0, 5).map((comp: any, idx: number) => (
                                        <tr key={idx} className="border-b border-orange-100 dark:border-orange-900/50">
                                          <td className="py-2 font-medium">{comp.sellerName}</td>
                                          <td className="py-2 text-center">
                                            <Badge variant="secondary">{comp.listingCount}</Badge>
                                          </td>
                                          <td className="py-2 text-right font-semibold">${comp.averagePrice?.toLocaleString()}</td>
                                          <td className="py-2 text-right text-muted-foreground">{comp.priceRange}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}

                            {/* AI Insights */}
                            {enhancedResults.aiInsights && (
                              <div className="bg-gradient-to-r from-violet-50 to-fuchsia-50 dark:from-violet-950/20 dark:to-fuchsia-950/20 border border-violet-200 dark:border-violet-900 rounded-lg p-6">
                                <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                                  <Sparkles className="w-5 h-5" />
                                  AI Market Insights
                                </h4>
                                <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                                  {enhancedResults.aiInsights}
                                </div>
                              </div>
                            )}

                            {/* Data Sources */}
                            {enhancedResults.sources && enhancedResults.sources.length > 0 && (
                              <div className="flex flex-wrap gap-2 items-center text-sm text-muted-foreground">
                                <span className="font-medium">Data from:</span>
                                {enhancedResults.sources.map((source: string, idx: number) => (
                                  <Badge key={idx} variant="outline" className="capitalize">
                                    {source}
                                  </Badge>
                                ))}
                                <span className="ml-2 text-xs">
                                  Last updated: {new Date(enhancedResults.scrapedAt).toLocaleString()}
                                </span>
                              </div>
                            )}
                          </>
                        )}

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
              )}

              {/* Inventory Analysis Tab */}
              {activeManagerTab === 'inventory' && (
                <InventoryAnalysisTab />
              )}

              {/* My Inventory Tab */}
              {activeManagerTab === 'my-inventory' && (
                <InventoryManagement />
              )}

              {/* Conversations Tab */}
              {activeManagerTab === 'conversations' && (
                <div data-testid="tab-content-conversations" className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">All Conversations</h3>
                      <p className="text-sm text-muted-foreground">
                        View website chat leads and Facebook Messenger conversations
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setAllConversations(null);
                        loadConversations();
                      }}
                      disabled={isLoadingConversations}
                      data-testid="button-refresh-conversations"
                    >
                      {isLoadingConversations ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4" />
                      )}
                    </Button>
                  </div>

                  {isLoadingConversations ? (
                    <div className="space-y-4">
                      <div className="h-32 bg-muted rounded animate-pulse" />
                      <div className="h-32 bg-muted rounded animate-pulse" />
                    </div>
                  ) : allConversations ? (
                    <div className="space-y-8">
                      {/* Website Chat Leads Section */}
                      <div>
                        <div className="flex items-center gap-2 mb-4">
                          <MessageSquare className="w-5 h-5 text-blue-600" />
                          <h4 className="font-semibold">Website Chat Leads</h4>
                          <Badge variant="secondary">{allConversations.totalWebsiteChats}</Badge>
                        </div>
                        {allConversations.websiteChats.length > 0 ? (
                          <div className="space-y-3">
                            {allConversations.websiteChats.map((chat: any) => (
                              <Card key={chat.id} className="p-4" data-testid={`website-chat-${chat.id}`}>
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                      <Badge variant={chat.category === 'test-drive' ? 'default' : chat.category === 'get-approved' ? 'secondary' : 'outline'}>
                                        {chat.category?.replace('-', ' ') || 'General'}
                                      </Badge>
                                      {chat.vehicleName && (
                                        <span className="text-sm font-medium">{chat.vehicleName}</span>
                                      )}
                                      {chat.handoffSent && (
                                        <Badge variant="outline" className="text-green-600 border-green-600">
                                          <Check className="w-3 h-3 mr-1" />
                                          SMS Sent
                                        </Badge>
                                      )}
                                    </div>
                                    <div className="text-sm text-muted-foreground mb-2">
                                      {chat.messages && chat.messages.length > 0 && (
                                        <p className="line-clamp-2">
                                          {chat.messages[chat.messages.length - 1]?.content || 'No messages'}
                                        </p>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                      <span className="flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        {new Date(chat.createdAt).toLocaleString('en-CA', {
                                          month: 'short',
                                          day: 'numeric',
                                          hour: '2-digit',
                                          minute: '2-digit'
                                        })}
                                      </span>
                                      {chat.handoffPhone && (
                                        <span className="flex items-center gap-1">
                                          📱 {chat.handoffPhone}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </Card>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-8 text-muted-foreground border rounded-lg">
                            <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                            <p className="text-sm">No website chat leads yet</p>
                          </div>
                        )}
                      </div>

                      {/* Facebook Messenger Conversations Section */}
                      <div>
                        <div className="flex items-center gap-2 mb-4">
                          <Users className="w-5 h-5 text-blue-600" />
                          <h4 className="font-semibold">Facebook Messenger</h4>
                          <Badge variant="secondary">{allConversations.totalMessengerConversations}</Badge>
                        </div>
                        {allConversations.messengerConversations.length > 0 ? (
                          <div className="space-y-3">
                            {allConversations.messengerConversations.map((conv: any) => (
                              <Card key={conv.id} className="p-4" data-testid={`messenger-conv-${conv.id}`}>
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                      <span className="font-medium">{conv.participantName}</span>
                                      {conv.unreadCount > 0 && (
                                        <Badge variant="destructive" className="text-xs">
                                          {conv.unreadCount} new
                                        </Badge>
                                      )}
                                    </div>
                                    <div className="text-sm text-muted-foreground mb-2">
                                      <p className="line-clamp-2">{conv.lastMessage || 'No messages yet'}</p>
                                    </div>
                                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                      <span className="flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        {conv.lastMessageAt ? new Date(conv.lastMessageAt).toLocaleString('en-CA', {
                                          month: 'short',
                                          day: 'numeric',
                                          hour: '2-digit',
                                          minute: '2-digit'
                                        }) : 'No messages'}
                                      </span>
                                      <span className="flex items-center gap-1">
                                        📄 {conv.pageName}
                                      </span>
                                      {conv.ownerName && (
                                        <span className="flex items-center gap-1">
                                          <Users className="w-3 h-3" />
                                          {conv.ownerName}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </Card>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-8 text-muted-foreground border rounded-lg">
                            <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                            <p className="text-sm">No Messenger conversations yet</p>
                            <p className="text-xs mt-1">Connect Facebook pages to see conversations here</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-50" />
                      <h3 className="text-lg font-medium mb-2">No Conversations</h3>
                      <p className="text-sm">Website chat leads and Messenger conversations will appear here</p>
                    </div>
                  )}
                </div>
              )}

              {/* AI Chat Prompts Tab */}
              {activeManagerTab === 'prompts' && (
                <div data-testid="tab-content-prompts">
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold">AI Chatbot Prompts</h3>
                    <p className="text-sm text-muted-foreground">Configure AI chat scenarios for your dealership website chatbot</p>
                  </div>
                  {isLoadingPrompts ? (
                    <div className="space-y-4">
                      <div className="h-32 bg-muted rounded animate-pulse" />
                      <div className="h-32 bg-muted rounded animate-pulse" />
                    </div>
                  ) : chatPrompts.length > 0 ? (
                    <div className="space-y-6">
                      {chatPrompts.map((prompt) => (
                        <div 
                          key={prompt.id} 
                          className="border rounded-lg p-4"
                          data-testid={`prompt-${prompt.scenario}`}
                        >
                          <div className="flex items-center justify-between mb-4">
                            <h4 className="font-semibold text-lg">{formatScenario(prompt.scenario)}</h4>
                            {editingPromptId !== prompt.id && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => startEditingPrompt(prompt)}
                                data-testid={`edit-prompt-${prompt.scenario}`}
                              >
                                <Pencil className="w-4 h-4 mr-2" />
                                Edit
                              </Button>
                            )}
                          </div>
                          
                          {editingPromptId === prompt.id ? (
                            <div className="space-y-4">
                              <div>
                                <Label htmlFor={`greeting-${prompt.id}`}>Greeting Message</Label>
                                <p className="text-xs text-muted-foreground mb-2">
                                  The first message shown to customers when they open the chat
                                </p>
                                <textarea
                                  id={`greeting-${prompt.id}`}
                                  className="w-full min-h-[100px] p-3 border rounded-md bg-background resize-y"
                                  value={editedPrompt.greeting}
                                  onChange={(e) => setEditedPrompt({ ...editedPrompt, greeting: e.target.value })}
                                  placeholder="Enter greeting message..."
                                  data-testid={`input-greeting-${prompt.scenario}`}
                                />
                              </div>
                              <div>
                                <Label htmlFor={`system-${prompt.id}`}>System Instructions</Label>
                                <p className="text-xs text-muted-foreground mb-2">
                                  Background instructions that guide the AI's behavior and responses
                                </p>
                                <textarea
                                  id={`system-${prompt.id}`}
                                  className="w-full min-h-[200px] p-3 border rounded-md bg-background resize-y font-mono text-sm"
                                  value={editedPrompt.systemPrompt}
                                  onChange={(e) => setEditedPrompt({ ...editedPrompt, systemPrompt: e.target.value })}
                                  placeholder="Enter system instructions..."
                                  data-testid={`input-system-${prompt.scenario}`}
                                />
                              </div>
                              <div className="flex gap-2 pt-2">
                                <Button
                                  onClick={() => savePrompt(prompt)}
                                  disabled={isSavingPrompt || !editedPrompt.greeting.trim() || !editedPrompt.systemPrompt.trim()}
                                  data-testid={`save-prompt-${prompt.scenario}`}
                                >
                                  {isSavingPrompt ? (
                                    <>
                                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                                      Saving...
                                    </>
                                  ) : (
                                    <>
                                      <Save className="w-4 h-4 mr-2" />
                                      Save Changes
                                    </>
                                  )}
                                </Button>
                                <Button
                                  variant="outline"
                                  onClick={cancelEditingPrompt}
                                  disabled={isSavingPrompt}
                                  data-testid={`cancel-prompt-${prompt.scenario}`}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-4">
                              <div>
                                <p className="text-sm font-medium text-muted-foreground mb-1">Greeting:</p>
                                <p className="text-sm bg-muted/50 p-3 rounded-md whitespace-pre-wrap">
                                  {prompt.greeting}
                                </p>
                              </div>
                              <div>
                                <p className="text-sm font-medium text-muted-foreground mb-1">System Instructions:</p>
                                <p className="text-xs bg-muted/50 p-3 rounded-md font-mono whitespace-pre-wrap max-h-[150px] overflow-y-auto">
                                  {prompt.systemPrompt}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <MessageSquare className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                      <p className="text-sm mb-4">No chat prompts configured yet</p>
                      <p className="text-xs">Chat prompts will appear here once they are created by the system administrator.</p>
                    </div>
                  )}
                </div>
              )}

              {/* Settings Tab */}
              {activeManagerTab === 'settings' && (
                <div data-testid="tab-content-settings">
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold">Location Settings</h3>
                    <p className="text-sm text-muted-foreground">Configure your location for market pricing searches</p>
                  </div>
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
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
