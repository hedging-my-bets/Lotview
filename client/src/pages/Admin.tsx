import { useState, useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Lock, MessageSquare, Settings, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Admin() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Check if already authenticated in session
  useEffect(() => {
    const token = sessionStorage.getItem('admin_token');
    if (token) {
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const data = await response.json();

      if (data.success) {
        sessionStorage.setItem('admin_token', data.token);
        setIsAuthenticated(true);
        toast({
          title: "Access Granted",
          description: "Welcome to the admin dashboard",
        });
      } else {
        toast({
          title: "Access Denied",
          description: "Incorrect password",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Login failed. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <div className="min-h-[calc(100vh-80px)] flex items-center justify-center p-4 pt-28">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 bg-primary rounded-full flex items-center justify-center mb-4">
                <Lock className="w-6 h-6 text-white" />
              </div>
              <CardTitle className="text-2xl">Admin Access</CardTitle>
              <CardDescription>
                Enter your password to access the admin dashboard
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <Input
                    type="password"
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    data-testid="input-admin-password"
                    className="w-full"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading || !password}
                  data-testid="button-admin-login"
                >
                  {isLoading ? "Authenticating..." : "Login"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <div className="pt-28 pb-12 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Admin Dashboard</h1>
            <p className="text-slate-600">Manage chat conversations and AI settings</p>
          </div>

          <Tabs defaultValue="conversations" className="w-full">
            <TabsList className="grid w-full grid-cols-4 mb-8">
              <TabsTrigger value="conversations" className="flex items-center gap-2" data-testid="tab-conversations">
                <MessageSquare className="w-4 h-4" />
                <span className="hidden sm:inline">Conversations</span>
              </TabsTrigger>
              <TabsTrigger value="prompts" className="flex items-center gap-2" data-testid="tab-prompts">
                <Settings className="w-4 h-4" />
                <span className="hidden sm:inline">Prompts</span>
              </TabsTrigger>
              <TabsTrigger value="insights" className="flex items-center gap-2" data-testid="tab-insights">
                <Sparkles className="w-4 h-4" />
                <span className="hidden sm:inline">AI Insights</span>
              </TabsTrigger>
              <TabsTrigger value="sms-config" className="flex items-center gap-2" data-testid="tab-sms-config">
                <MessageSquare className="w-4 h-4" />
                <span className="hidden sm:inline">SMS Config</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="conversations">
              <ConversationsTab />
            </TabsContent>

            <TabsContent value="prompts">
              <PromptsTab />
            </TabsContent>

            <TabsContent value="insights">
              <InsightsTab />
            </TabsContent>

            <TabsContent value="sms-config">
              <SMSConfigTab />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

function ConversationsTab() {
  const [conversations, setConversations] = useState<any[]>([]);
  const [filteredConversations, setFilteredConversations] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [selectedConversation, setSelectedConversation] = useState<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchConversations();
  }, []);

  useEffect(() => {
    filterConversations();
  }, [conversations, selectedCategory, searchQuery]);

  const fetchConversations = async () => {
    try {
      setIsLoading(true);
      const token = sessionStorage.getItem('admin_token');
      const response = await fetch("/api/conversations", {
        headers: {
          'x-admin-token': token || '',
        },
      });
      if (!response.ok) throw new Error("Failed to fetch conversations");
      const data = await response.json();
      setConversations(data);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load conversations",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const filterConversations = () => {
    let filtered = conversations;

    // Filter by category
    if (selectedCategory !== "all") {
      filtered = filtered.filter(conv => conv.category === selectedCategory);
    }

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(conv => {
        const vehicleName = conv.vehicleName?.toLowerCase() || '';
        const messages = JSON.stringify(conv.messages).toLowerCase();
        const query = searchQuery.toLowerCase();
        return vehicleName.includes(query) || messages.includes(query);
      });
    }

    setFilteredConversations(filtered);
  };

  const categoryStats = {
    all: conversations.length,
    'test-drive': conversations.filter(c => c.category === 'test-drive').length,
    'get-approved': conversations.filter(c => c.category === 'get-approved').length,
    'value-trade': conversations.filter(c => c.category === 'value-trade').length,
    'reserve': conversations.filter(c => c.category === 'reserve').length,
    'general': conversations.filter(c => c.category === 'general').length,
  };

  const categories = [
    { value: 'all', label: 'All Conversations', count: categoryStats.all },
    { value: 'test-drive', label: 'Test Drive', count: categoryStats['test-drive'] },
    { value: 'get-approved', label: 'Get Pre-Approved', count: categoryStats['get-approved'] },
    { value: 'value-trade', label: 'Value Trade-in', count: categoryStats['value-trade'] },
    { value: 'reserve', label: 'Reserve Vehicle', count: categoryStats['reserve'] },
    { value: 'general', label: 'General Chat', count: categoryStats['general'] },
  ];

  if (isLoading) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <div className="text-slate-500">Loading conversations...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Conversation List */}
      <div className="lg:col-span-1">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Conversations ({filteredConversations.length})</CardTitle>
            <div className="pt-2">
              <Input
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="input-search-conversations"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="border-b">
              <div className="flex flex-col">
                {categories.map(cat => (
                  <button
                    key={cat.value}
                    onClick={() => setSelectedCategory(cat.value)}
                    className={`px-4 py-3 text-left transition border-l-2 hover:bg-slate-50 ${
                      selectedCategory === cat.value
                        ? 'bg-slate-50 border-primary text-primary font-medium'
                        : 'border-transparent text-slate-600'
                    }`}
                    data-testid={`button-category-${cat.value}`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-sm">{cat.label}</span>
                      <span className="text-xs bg-slate-200 px-2 py-1 rounded">{cat.count}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <div className="max-h-[500px] overflow-y-auto">
              {filteredConversations.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm" data-testid="text-no-conversations">
                  No conversations found
                </div>
              ) : (
                filteredConversations.map(conv => (
                  <button
                    key={conv.id}
                    onClick={() => setSelectedConversation(conv)}
                    className={`w-full px-4 py-3 text-left border-b hover:bg-slate-50 transition ${
                      selectedConversation?.id === conv.id ? 'bg-blue-50' : ''
                    }`}
                    data-testid={`button-conversation-${conv.id}`}
                  >
                    <div className="font-medium text-sm text-slate-900 mb-1">
                      {conv.vehicleName || 'General Chat'}
                    </div>
                    <div className="text-xs text-slate-500 mb-1">
                      {new Date(conv.createdAt).toLocaleDateString()} at {new Date(conv.createdAt).toLocaleTimeString()}
                    </div>
                    <div className="text-xs text-slate-400">
                      {conv.messages?.length || 0} messages
                    </div>
                  </button>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Conversation Detail */}
      <div className="lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>Conversation Details</CardTitle>
            <CardDescription>
              {selectedConversation 
                ? `${selectedConversation.vehicleName || 'General Chat'} - ${selectedConversation.category}`
                : 'Select a conversation to view details'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!selectedConversation ? (
              <div className="text-center py-12 text-slate-400" data-testid="text-select-conversation">
                Select a conversation from the list to view details
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-slate-50 p-4 rounded-lg space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Category:</span>
                    <span className="font-medium capitalize">{selectedConversation.category}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Vehicle:</span>
                    <span className="font-medium">{selectedConversation.vehicleName || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Date:</span>
                    <span className="font-medium">
                      {new Date(selectedConversation.createdAt).toLocaleDateString()} at{' '}
                      {new Date(selectedConversation.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Session ID:</span>
                    <span className="font-mono text-xs">{selectedConversation.sessionId}</span>
                  </div>
                </div>

                <div className="border rounded-lg p-4 max-h-[600px] overflow-y-auto space-y-3">
                  {selectedConversation.messages?.map((msg: any, idx: number) => (
                    <div
                      key={idx}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] p-3 rounded-xl text-sm ${
                          msg.role === 'user'
                            ? 'bg-primary text-white rounded-br-none'
                            : 'bg-slate-100 text-slate-700 rounded-tl-none'
                        }`}
                        data-testid={`message-${idx}`}
                      >
                        <div className="font-semibold text-xs mb-1 opacity-70">
                          {msg.role === 'user' ? 'Customer' : 'Assistant'}
                        </div>
                        {msg.content}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function PromptsTab() {
  const [prompts, setPrompts] = useState<any[]>([]);
  const [selectedScenario, setSelectedScenario] = useState("test-drive");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [greeting, setGreeting] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const scenarios = [
    { value: 'test-drive', label: 'Test Drive Requests', description: 'When customer wants to book a test drive' },
    { value: 'get-approved', label: 'Pre-Approval Requests', description: 'When customer wants to get pre-approved for financing' },
    { value: 'value-trade', label: 'Trade-in Valuations', description: 'When customer wants to value their trade-in' },
    { value: 'reserve', label: 'Vehicle Reservations', description: 'When customer wants to reserve a vehicle' },
    { value: 'general', label: 'General Chat', description: 'Default chat without specific CTA' },
  ];

  useEffect(() => {
    fetchPrompts();
  }, []);

  useEffect(() => {
    loadPromptForScenario(selectedScenario);
  }, [selectedScenario, prompts]);

  const fetchPrompts = async () => {
    try {
      setIsLoading(true);
      const token = sessionStorage.getItem('admin_token');
      const response = await fetch("/api/chat-prompts", {
        headers: {
          'x-admin-token': token || '',
        },
      });
      if (!response.ok) throw new Error("Failed to fetch prompts");
      const data = await response.json();
      setPrompts(data);
    } catch (error) {
      console.error("Error fetching prompts:", error);
      // Set default empty prompts if none exist
      setPrompts([]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadPromptForScenario = (scenario: string) => {
    const prompt = prompts.find(p => p.scenario === scenario);
    if (prompt) {
      setSystemPrompt(prompt.systemPrompt);
      setGreeting(prompt.greeting);
    } else {
      // Set default prompts
      setSystemPrompt(getDefaultSystemPrompt(scenario));
      setGreeting(getDefaultGreeting(scenario));
    }
  };

  const getDefaultSystemPrompt = (scenario: string) => {
    const defaults: Record<string, string> = {
      'test-drive': 'You are a helpful car sales assistant for Olympic Auto Group. Help customers schedule test drives. Be friendly, professional, and efficient. Ask for their preferred date/time and contact information.',
      'get-approved': 'You are a helpful financing specialist for Olympic Auto Group. Guide customers through the pre-approval process. Explain the benefits, ask for basic information (name, email, phone), and reassure them about the quick process.',
      'value-trade': 'You are a helpful trade-in specialist for Olympic Auto Group. Help customers get accurate valuations for their current vehicle. Ask about year, make, model, mileage, and condition. Be encouraging and emphasize fair market value.',
      'reserve': 'You are a helpful sales consultant for Olympic Auto Group. Assist customers with vehicle reservations. Explain the reservation process, $500 refundable deposit, and benefits of securing the vehicle.',
      'general': 'You are a helpful car sales assistant for Olympic Auto Group. Answer questions about vehicles, financing, dealership locations, and help guide customers to the right actions (test drive, trade-in, financing).',
    };
    return defaults[scenario] || '';
  };

  const getDefaultGreeting = (scenario: string) => {
    const defaults: Record<string, string> = {
      'test-drive': 'Great choice! I can help you schedule a test drive. When would work best for you this week?',
      'get-approved': 'Excellent! Getting pre-approved is quick and easy. May I start by getting your name and contact information?',
      'value-trade': 'I\'d be happy to help value your trade-in. To provide an accurate estimate, could you tell me the year, make, and model of your current vehicle?',
      'reserve': 'Perfect! To reserve this vehicle, we require a $500 refundable deposit. Would you like to proceed?',
      'general': 'Welcome to Olympic Auto Group! How can I help you find your dream car today?',
    };
    return defaults[scenario] || '';
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const token = sessionStorage.getItem('admin_token');
      const response = await fetch("/api/chat-prompts", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-admin-token": token || '',
        },
        body: JSON.stringify({
          scenario: selectedScenario,
          systemPrompt,
          greeting,
        }),
      });

      if (!response.ok) throw new Error("Failed to save prompt");

      toast({
        title: "Success",
        description: "Chat prompt saved successfully",
      });

      // Refresh prompts
      fetchPrompts();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save chat prompt",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <div className="text-slate-500">Loading prompts...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      {/* Scenario Selector */}
      <div className="lg:col-span-1">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Scenarios</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="flex flex-col">
              {scenarios.map(scenario => (
                <button
                  key={scenario.value}
                  onClick={() => setSelectedScenario(scenario.value)}
                  className={`px-4 py-3 text-left transition border-l-2 hover:bg-slate-50 ${
                    selectedScenario === scenario.value
                      ? 'bg-slate-50 border-primary text-primary font-medium'
                      : 'border-transparent text-slate-600'
                  }`}
                  data-testid={`button-scenario-${scenario.value}`}
                >
                  <div className="text-sm font-medium mb-1">{scenario.label}</div>
                  <div className="text-xs text-slate-400">{scenario.description}</div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Prompt Editor */}
      <div className="lg:col-span-3">
        <Card>
          <CardHeader>
            <CardTitle>Edit Prompt for {scenarios.find(s => s.value === selectedScenario)?.label}</CardTitle>
            <CardDescription>
              Customize how the AI assistant responds for this scenario
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">System Prompt</label>
              <p className="text-xs text-slate-500 mb-2">
                Instructions for how the AI should behave in this scenario
              </p>
              <textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                rows={6}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                placeholder="Enter system prompt..."
                data-testid="textarea-system-prompt"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Initial Greeting</label>
              <p className="text-xs text-slate-500 mb-2">
                The first message customers see when they trigger this scenario
              </p>
              <textarea
                value={greeting}
                onChange={(e) => setGreeting(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                placeholder="Enter initial greeting..."
                data-testid="textarea-greeting"
              />
            </div>

            <div className="flex gap-3">
              <Button
                onClick={handleSave}
                disabled={isSaving || !systemPrompt || !greeting}
                className="flex-1"
                data-testid="button-save-prompt"
              >
                {isSaving ? "Saving..." : "Save Prompt"}
              </Button>
              <Button
                onClick={() => loadPromptForScenario(selectedScenario)}
                variant="outline"
                data-testid="button-reset-prompt"
              >
                Reset
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function InsightsTab() {
  const [selectedScenario, setSelectedScenario] = useState("test-drive");
  const [insights, setInsights] = useState<string>("");
  const [conversationCount, setConversationCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const scenarios = [
    { value: 'test-drive', label: 'Test Drive Requests' },
    { value: 'get-approved', label: 'Pre-Approval Requests' },
    { value: 'value-trade', label: 'Trade-in Valuations' },
    { value: 'reserve', label: 'Vehicle Reservations' },
    { value: 'general', label: 'General Chat' },
  ];

  const handleGenerateInsights = async () => {
    try {
      setIsLoading(true);
      const token = sessionStorage.getItem('admin_token');
      const response = await fetch("/api/chat-insights", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-admin-token": token || '',
        },
        body: JSON.stringify({ scenario: selectedScenario }),
      });

      if (!response.ok) throw new Error("Failed to generate insights");

      const data = await response.json();
      setInsights(data.insights);
      setConversationCount(data.conversationCount || 0);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate insights",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      {/* Scenario Selector */}
      <div className="lg:col-span-1">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Select Scenario</CardTitle>
            <CardDescription className="text-xs">
              Choose a scenario to analyze
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="flex flex-col">
              {scenarios.map(scenario => (
                <button
                  key={scenario.value}
                  onClick={() => setSelectedScenario(scenario.value)}
                  className={`px-4 py-3 text-left transition border-l-2 hover:bg-slate-50 ${
                    selectedScenario === scenario.value
                      ? 'bg-slate-50 border-primary text-primary font-medium'
                      : 'border-transparent text-slate-600'
                  }`}
                  data-testid={`button-insight-scenario-${scenario.value}`}
                >
                  <div className="text-sm">{scenario.label}</div>
                </button>
              ))}
            </div>
          </CardContent>
          <div className="p-4 border-t">
            <Button
              onClick={handleGenerateInsights}
              disabled={isLoading}
              className="w-full"
              data-testid="button-generate-insights"
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Analyzing...
                </div>
              ) : (
                "Generate Insights"
              )}
            </Button>
          </div>
        </Card>
      </div>

      {/* Insights Display */}
      <div className="lg:col-span-3">
        <Card>
          <CardHeader>
            <CardTitle>AI Analysis for {scenarios.find(s => s.value === selectedScenario)?.label}</CardTitle>
            <CardDescription>
              {conversationCount > 0 
                ? `Analysis based on ${conversationCount} conversations`
                : 'Generate insights to see AI-powered recommendations'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!insights && !isLoading ? (
              <div className="text-center py-12">
                <Sparkles className="w-12 h-12 mx-auto text-slate-300 mb-4" />
                <p className="text-slate-500 mb-2">Ready to analyze conversations</p>
                <p className="text-sm text-slate-400" data-testid="text-no-insights">
                  Click "Generate Insights" to get AI-powered recommendations
                </p>
              </div>
            ) : isLoading ? (
              <div className="text-center py-12">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-slate-500">Analyzing conversations with AI...</p>
              </div>
            ) : (
              <div className="prose prose-sm max-w-none">
                <div 
                  className="bg-slate-50 p-6 rounded-lg whitespace-pre-wrap text-sm leading-relaxed"
                  data-testid="text-insights-content"
                >
                  {insights}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


function SMSConfigTab() {
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookName, setWebhookName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchWebhookConfig();
  }, []);

  const fetchWebhookConfig = async () => {
    try {
      setIsLoading(true);
      const token = sessionStorage.getItem("admin_token");
      const response = await fetch("/api/admin/ghl-webhook-config", {
        headers: {
          "x-admin-token": token || "",
        },
      });
      if (!response.ok) throw new Error("Failed to fetch webhook config");
      const data = await response.json();
      
      if (data) {
        setWebhookUrl(data.webhookUrl || "");
        setWebhookName(data.webhookName || "");
      }
    } catch (error) {
      console.error("Error fetching webhook config:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!webhookUrl || !webhookName) {
      toast({
        title: "Validation Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSaving(true);
      const token = sessionStorage.getItem("admin_token");
      const response = await fetch("/api/admin/ghl-webhook-config", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-admin-token": token || "",
        },
        body: JSON.stringify({
          webhookUrl,
          webhookName,
        }),
      });

      if (!response.ok) throw new Error("Failed to save webhook config");

      toast({
        title: "Success",
        description: "GHL webhook configuration saved successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save webhook configuration",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-500">Loading configuration...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>SMS Handoff Configuration</CardTitle>
        <CardDescription>
          Configure GoHighLevel webhook to enable SMS handoff for chatbot conversations
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-semibold text-blue-900 mb-2">How SMS Handoff Works</h4>
          <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
            <li>Customer chats with AI bot on your website</li>
            <li>Bot offers to continue conversation via text message</li>
            <li>Customer provides their phone number</li>
            <li>Conversation summary is sent to GHL webhook</li>
            <li>GHL chatbot continues the conversation via SMS</li>
          </ol>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Webhook Name
            </label>
            <Input
              type="text"
              placeholder="e.g., SMS Handoff - Olympic Auto"
              value={webhookName}
              onChange={(e) => setWebhookName(e.target.value)}
              data-testid="input-webhook-name"
            />
            <p className="text-xs text-slate-500 mt-1">
              Descriptive name for this webhook configuration
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              GoHighLevel Inbound Webhook URL
            </label>
            <Input
              type="url"
              placeholder="https://services.leadconnectorhq.com/hooks/..."
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              data-testid="input-webhook-url"
            />
            <p className="text-xs text-slate-500 mt-1">
              Create an inbound webhook in GHL and paste the URL here
            </p>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
          <h4 className="font-semibold text-slate-700 mb-2">Webhook Payload Format</h4>
          <pre className="text-xs bg-white p-3 rounded border overflow-x-auto">
{`{
  "phone": "(555) 123-4567",
  "conversationSummary": "Bot: Hi!\\n\\nCustomer: I want info...",
  "category": "test-drive",
  "vehicleInfo": { ... },
  "timestamp": "2025-01-15T12:00:00Z",
  "source": "olympic-auto-website"
}`}
          </pre>
        </div>

        <Button
          onClick={handleSave}
          disabled={isSaving || !webhookUrl || !webhookName}
          className="w-full"
          data-testid="button-save-webhook-config"
        >
          {isSaving ? "Saving..." : "Save Configuration"}
        </Button>
      </CardContent>
    </Card>
  );
}

