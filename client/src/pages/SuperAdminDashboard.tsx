import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Building2, Key, FileText, Plus, Eye, EyeOff, Trash2, LogOut, Settings2, CheckCircle2, XCircle, Loader2, Plug, Pencil, Webhook, Copy, AlertCircle, Clock, Link2, RefreshCw, Car, Rocket, Users, UserX, KeyRound, Search } from "lucide-react";
import OnboardingWizard from "@/components/OnboardingWizard";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";

interface Dealership {
  id: number;
  name: string;
  slug: string;
  subdomain: string;
  address?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  phone?: string;
  timezone?: string;
  defaultCurrency?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface GlobalSetting {
  id: number;
  key: string;
  value: string;
  description: string | null;
  isSecret: boolean;
  updatedBy: number | null;
  createdAt: string;
  updatedAt: string;
}

interface AuditLog {
  id: number;
  userId: number;
  action: string;
  resource: string;
  resourceId: string | null;
  details: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

interface User {
  id: number;
  email: string;
  name: string;
  role: string;
  dealershipId: number | null;
  isActive: boolean;
}

interface UserWithDealership extends User {
  dealershipName?: string;
  createdAt?: string;
}

interface DealershipWithIntegrations extends Dealership {
  integrations: {
    openai: boolean;
    facebook: boolean;
    marketcheck: boolean;
    apify: boolean;
    gemini: boolean;
    ghl: boolean;
    googleAnalytics: boolean;
    googleAds: boolean;
    facebookPixel: boolean;
    n8n: boolean;
  };
  n8nTokenCount?: number;
}

interface DealershipApiKeys {
  dealershipId: number;
  openaiApiKey: string | null;
  facebookAppId: string | null;
  facebookAppSecret: string | null;
  marketcheckKey: string | null;
  apifyToken: string | null;
  apifyActorId: string | null;
  geminiApiKey: string | null;
  ghlApiKey: string | null;
  ghlLocationId: string | null;
  gtmContainerId: string | null;
  googleAnalyticsId: string | null;
  googleAdsId: string | null;
  facebookPixelId: string | null;
}

interface ScrapeSource {
  id: number;
  dealershipId: number;
  sourceName: string;
  sourceUrl: string;
  sourceType: string;
  scrapeFrequency: string;
  vehicleCount: number;
  lastScrapedAt: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function SuperAdminDashboard() {
  const [, setLocation] = useLocation();
  const [user, setUser] = useState<User | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

  const handleLogout = async () => {
    const token = localStorage.getItem('auth_token');
    
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
    } catch (error) {
      console.error("Logout error:", error);
    }

    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
    setLocation('/login');
  };

  // Check authentication on mount
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (!storedUser) {
      setLocation('/login');
      return;
    }
    const parsedUser = JSON.parse(storedUser);
    if (parsedUser.role !== 'super_admin') {
      setLocation('/login');
      return;
    }
    setUser(parsedUser);
  }, [setLocation]);

  // Dealerships
  const { data: dealerships = [], isLoading: dealershipsLoading } = useQuery<Dealership[]>({
    queryKey: ["/api/super-admin/dealerships"],
  });

  // Global Settings
  const { data: settings = [], isLoading: settingsLoading } = useQuery<GlobalSetting[]>({
    queryKey: ["/api/super-admin/global-settings"],
  });

  // Audit Logs
  const { data: auditLogsData, isLoading: auditLogsLoading } = useQuery<{ logs: AuditLog[]; total: number }>({
    queryKey: ["/api/super-admin/audit-logs"],
  });

  // Dealerships with integrations status
  const { data: dealershipsWithIntegrations = [], isLoading: integrationsLoading } = useQuery<DealershipWithIntegrations[]>({
    queryKey: ["/api/super-admin/dealerships-with-integrations"],
  });

  // Scrape Sources (all dealerships)
  const { data: scrapeSources = [], isLoading: scrapeSourcesLoading, refetch: refetchScrapeSources } = useQuery<ScrapeSource[]>({
    queryKey: ["/api/super-admin/scrape-sources"],
  });
  
  // All Users (for super admin user management)
  const [userFilters, setUserFilters] = useState<{ dealershipId?: number; role?: string; search?: string }>({});
  const { data: allUsers = [], isLoading: usersLoading, refetch: refetchUsers } = useQuery<UserWithDealership[]>({
    queryKey: ["/api/super-admin/users", userFilters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (userFilters.dealershipId) params.set('dealershipId', userFilters.dealershipId.toString());
      if (userFilters.role) params.set('role', userFilters.role);
      if (userFilters.search) params.set('search', userFilters.search);
      const response = await fetch(`/api/super-admin/users?${params}`, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch users');
      return response.json();
    }
  });

  // Create Dealership Mutation
  const createDealershipMutation = useMutation({
    mutationFn: async (data: {
      name: string;
      slug: string;
      subdomain: string;
      address?: string;
      city?: string;
      province?: string;
      postalCode?: string;
      phone?: string;
      timezone?: string;
      defaultCurrency?: string;
      masterAdminEmail: string;
      masterAdminName: string;
      masterAdminPassword: string;
      openaiApiKey?: string;
      marketcheckKey?: string;
      apifyToken?: string;
      apifyActorId?: string;
      geminiApiKey?: string;
      ghlApiKey?: string;
      ghlLocationId?: string;
      facebookAppId?: string;
      facebookAppSecret?: string;
    }) => {
      const response = await fetch("/api/super-admin/dealerships", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create dealership");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/dealerships"] });
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/audit-logs"] });
      toast({ title: "Success", description: "Dealership created successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Set Global Setting Mutation
  const setSettingMutation = useMutation({
    mutationFn: async (data: { key: string; value: string; description?: string; isSecret?: boolean }) => {
      const response = await fetch(`/api/super-admin/global-settings/${data.key}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          value: data.value,
          description: data.description,
          isSecret: data.isSecret ?? true,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to set setting");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/global-settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/audit-logs"] });
      toast({ title: "Success", description: "Setting updated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Delete Global Setting Mutation
  const deleteSettingMutation = useMutation({
    mutationFn: async (key: string) => {
      const response = await fetch(`/api/super-admin/global-settings/${key}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete setting");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/global-settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/audit-logs"] });
      toast({ title: "Success", description: "Setting deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
  
  // Delete User Mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      const response = await fetch(`/api/super-admin/users/${userId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete user");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/audit-logs"] });
      toast({ title: "Success", description: "User deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
  
  // Update User Status Mutation
  const updateUserStatusMutation = useMutation({
    mutationFn: async ({ userId, isActive }: { userId: number; isActive: boolean }) => {
      const response = await fetch(`/api/super-admin/users/${userId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ isActive }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update user status");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/audit-logs"] });
      toast({ title: "Success", description: "User status updated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
  
  // Reset User Password Mutation
  const resetPasswordMutation = useMutation({
    mutationFn: async ({ userId, newPassword }: { userId: number; newPassword: string }) => {
      const response = await fetch(`/api/super-admin/users/${userId}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ newPassword }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to reset password");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/audit-logs"] });
      toast({ title: "Success", description: "Password reset successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  if (user?.role !== "super_admin") {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>You do not have permission to access this page.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 sm:p-6" data-testid="super-admin-dashboard">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Super Admin Dashboard</h1>
          <p className="text-muted-foreground">System-wide administration and configuration</p>
        </div>
        <Button onClick={handleLogout} variant="outline" data-testid="button-logout" className="w-full sm:w-auto">
          <LogOut className="w-4 h-4 mr-2" />
          Logout
        </Button>
      </div>

      <Tabs defaultValue="dealerships" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="dealerships" data-testid="tab-dealerships" className="text-xs sm:text-sm px-2 sm:px-3 py-2">
            <Building2 className="h-4 w-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Dealerships</span>
            <span className="sm:hidden">Dealers</span>
          </TabsTrigger>
          <TabsTrigger value="integrations" data-testid="tab-integrations" className="text-xs sm:text-sm px-2 sm:px-3 py-2">
            <Plug className="h-4 w-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">API Integrations</span>
            <span className="sm:hidden">APIs</span>
          </TabsTrigger>
          <TabsTrigger value="settings" data-testid="tab-settings" className="text-xs sm:text-sm px-2 sm:px-3 py-2">
            <Key className="h-4 w-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Global Settings</span>
            <span className="sm:hidden">Settings</span>
          </TabsTrigger>
          <TabsTrigger value="audit" data-testid="tab-audit" className="text-xs sm:text-sm px-2 sm:px-3 py-2">
            <FileText className="h-4 w-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Audit Logs</span>
            <span className="sm:hidden">Logs</span>
          </TabsTrigger>
          <TabsTrigger value="scrape-sources" data-testid="tab-scrape-sources" className="text-xs sm:text-sm px-2 sm:px-3 py-2">
            <Link2 className="h-4 w-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Scrape Sources</span>
            <span className="sm:hidden">Scrape</span>
          </TabsTrigger>
          <TabsTrigger value="users" data-testid="tab-users" className="text-xs sm:text-sm px-2 sm:px-3 py-2">
            <Users className="h-4 w-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">User Management</span>
            <span className="sm:hidden">Users</span>
          </TabsTrigger>
          <TabsTrigger value="onboarding" data-testid="tab-onboarding" className="text-xs sm:text-sm px-2 sm:px-3 py-2 bg-green-600/10 hover:bg-green-600/20">
            <Rocket className="h-4 w-4 mr-1 sm:mr-2 text-green-600" />
            <span className="hidden sm:inline text-green-600 font-medium">Onboard New</span>
            <span className="sm:hidden text-green-600">+New</span>
          </TabsTrigger>
        </TabsList>

        {/* Dealerships Tab */}
        <TabsContent value="dealerships">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <div>
                  <CardTitle>Dealerships</CardTitle>
                  <CardDescription>Manage all dealerships in the system</CardDescription>
                </div>
                <CreateDealershipDialog onSubmit={(data) => createDealershipMutation.mutate(data)} />
              </div>
            </CardHeader>
            <CardContent>
              {dealershipsLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading dealerships...</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Slug</TableHead>
                        <TableHead>Subdomain</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dealerships.map((dealership) => (
                        <TableRow key={dealership.id} data-testid={`dealership-row-${dealership.id}`}>
                          <TableCell className="font-medium">{dealership.name}</TableCell>
                          <TableCell>{dealership.slug}</TableCell>
                          <TableCell>{dealership.subdomain}</TableCell>
                          <TableCell>
                            <Badge variant={dealership.isActive ? "default" : "secondary"}>
                              {dealership.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell>{format(new Date(dealership.createdAt), "PPP")}</TableCell>
                          <TableCell className="text-right">
                            <EditDealershipDialog 
                              dealership={dealership}
                              onSuccess={() => {
                                queryClient.invalidateQueries({ queryKey: ["/api/super-admin/dealerships"] });
                              }}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* API Integrations Tab */}
        <TabsContent value="integrations">
          <Card>
            <CardHeader>
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Plug className="h-5 w-5" />
                  API Integrations
                </CardTitle>
                <CardDescription>Manage OpenAI, Facebook, and other service integrations for each dealership</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {integrationsLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading integrations...</div>
              ) : dealershipsWithIntegrations.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No dealerships found. Create a dealership first.</div>
              ) : (
                <div className="space-y-6">
                  {dealershipsWithIntegrations.map((dealership) => (
                    <Card key={dealership.id} className="border-2">
                      <CardHeader className="pb-3">
                        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                          <div>
                            <CardTitle className="text-lg">{dealership.name}</CardTitle>
                            <CardDescription>Configure API keys and integration settings</CardDescription>
                          </div>
                          <EditApiKeysDialog 
                            dealershipId={dealership.id} 
                            dealershipName={dealership.name}
                            onSuccess={() => {
                              queryClient.invalidateQueries({ queryKey: ["/api/super-admin/dealerships-with-integrations"] });
                            }}
                          />
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                          <IntegrationStatus label="OpenAI" active={dealership.integrations.openai} />
                          <IntegrationStatus label="Facebook" active={dealership.integrations.facebook} />
                          <IntegrationStatus label="MarketCheck" active={dealership.integrations.marketcheck} />
                          <IntegrationStatus label="Apify" active={dealership.integrations.apify} />
                          <IntegrationStatus label="GoHighLevel" active={dealership.integrations.ghl} />
                          <IntegrationStatus label="GA4" active={dealership.integrations.googleAnalytics} />
                          <IntegrationStatus label="Google Ads" active={dealership.integrations.googleAds} />
                          <IntegrationStatus label="FB Pixel" active={dealership.integrations.facebookPixel} />
                          <IntegrationStatus label="Gemini" active={dealership.integrations.gemini} />
                          <N8nTokensDialog 
                            dealershipId={dealership.id}
                            dealershipName={dealership.name}
                            active={dealership.integrations.n8n}
                            tokenCount={dealership.n8nTokenCount || 0}
                            onSuccess={() => {
                              queryClient.invalidateQueries({ queryKey: ["/api/super-admin/dealerships-with-integrations"] });
                            }}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Global Settings Tab */}
        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <div>
                  <CardTitle>Global Settings</CardTitle>
                  <CardDescription>Configure system-wide API keys and settings</CardDescription>
                </div>
                <AddSettingDialog onSubmit={(data) => setSettingMutation.mutate(data)} />
              </div>
            </CardHeader>
            <CardContent>
              {settingsLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading settings...</div>
              ) : (
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Key</TableHead>
                      <TableHead>Value</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Updated</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {settings.map((setting) => (
                      <TableRow key={setting.id} data-testid={`setting-row-${setting.key}`}>
                        <TableCell className="font-mono font-medium">{setting.key}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {setting.isSecret && !showSecrets[setting.key] ? (
                              <span className="text-muted-foreground">••••••••</span>
                            ) : (
                              <span className="font-mono text-sm">{setting.value}</span>
                            )}
                            {setting.isSecret && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowSecrets({ ...showSecrets, [setting.key]: !showSecrets[setting.key] })}
                                data-testid={`toggle-secret-${setting.key}`}
                              >
                                {showSecrets[setting.key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </Button>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{setting.description || "—"}</TableCell>
                        <TableCell>
                          <Badge variant={setting.isSecret ? "default" : "secondary"}>
                            {setting.isSecret ? "Secret" : "Public"}
                          </Badge>
                        </TableCell>
                        <TableCell>{format(new Date(setting.updatedAt), "PPP")}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (confirm(`Delete setting "${setting.key}"?`)) {
                                deleteSettingMutation.mutate(setting.key);
                              }
                            }}
                            data-testid={`delete-setting-${setting.key}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Audit Logs Tab */}
        <TabsContent value="audit">
          <Card>
            <CardHeader>
              <CardTitle>Audit Logs</CardTitle>
              <CardDescription>System-wide activity and security tracking</CardDescription>
            </CardHeader>
            <CardContent>
              {auditLogsLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading audit logs...</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Timestamp</TableHead>
                        <TableHead>User ID</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Resource</TableHead>
                        <TableHead>Details</TableHead>
                        <TableHead>IP Address</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auditLogsData?.logs.map((log) => (
                        <TableRow key={log.id} data-testid={`audit-log-${log.id}`}>
                          <TableCell>{format(new Date(log.createdAt), "PPpp")}</TableCell>
                          <TableCell>{log.userId}</TableCell>
                          <TableCell>
                            <Badge>{log.action}</Badge>
                          </TableCell>
                          <TableCell className="font-mono text-sm">{log.resource}</TableCell>
                          <TableCell className="text-muted-foreground max-w-xs truncate">{log.details || "—"}</TableCell>
                          <TableCell className="font-mono text-sm">{log.ipAddress || "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Scrape Sources Tab */}
        <TabsContent value="scrape-sources">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <div>
                  <CardTitle>Inventory Scrape Sources</CardTitle>
                  <CardDescription>Manage inventory scraping URLs for all dealerships</CardDescription>
                </div>
                <CreateScrapeSourceDialog 
                  dealerships={dealerships} 
                  onSuccess={() => refetchScrapeSources()} 
                />
              </div>
            </CardHeader>
            <CardContent>
              {scrapeSourcesLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading scrape sources...</div>
              ) : scrapeSources.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Car className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No inventory sources configured yet. Add a URL to start scraping vehicles.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {dealerships.map(dealership => {
                    const dealershipSources = scrapeSources.filter(s => s.dealershipId === dealership.id);
                    if (dealershipSources.length === 0) return null;
                    
                    return (
                      <div key={dealership.id} className="border rounded-lg p-4" data-testid={`dealership-sources-${dealership.id}`}>
                        <h3 className="font-semibold mb-3 flex items-center gap-2">
                          <Building2 className="w-4 h-4" />
                          {dealership.name}
                        </h3>
                        <div className="space-y-3">
                          {dealershipSources.map(source => (
                            <ScrapeSourceRow 
                              key={source.id} 
                              source={source} 
                              onUpdate={() => refetchScrapeSources()} 
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  
                  {/* Sources without dealership or unmatched dealerships */}
                  {scrapeSources.filter(s => !dealerships.some(d => d.id === s.dealershipId)).length > 0 && (
                    <div className="border rounded-lg p-4 border-yellow-500/50">
                      <h3 className="font-semibold mb-3 flex items-center gap-2 text-yellow-600">
                        <AlertCircle className="w-4 h-4" />
                        Unassigned Sources
                      </h3>
                      <div className="space-y-3">
                        {scrapeSources.filter(s => !dealerships.some(d => d.id === s.dealershipId)).map(source => (
                          <ScrapeSourceRow 
                            key={source.id} 
                            source={source} 
                            onUpdate={() => refetchScrapeSources()} 
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              <div className="mt-4 p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">
                  <strong>Tip:</strong> Add multiple inventory sources to aggregate vehicles from different locations 
                  or platforms. Daily scraping is recommended for accurate inventory.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Users Management Tab */}
        <TabsContent value="users">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <div>
                  <CardTitle>User Management</CardTitle>
                  <CardDescription>Manage users across all dealerships</CardDescription>
                </div>
                <Button 
                  variant="outline" 
                  onClick={() => refetchUsers()}
                  data-testid="refresh-users"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name or email..."
                      className="pl-10"
                      value={userFilters.search || ''}
                      onChange={(e) => setUserFilters(prev => ({ ...prev, search: e.target.value }))}
                      data-testid="search-users"
                    />
                  </div>
                </div>
                <select
                  className="border rounded-md px-3 py-2 text-sm bg-background"
                  value={userFilters.dealershipId || ''}
                  onChange={(e) => setUserFilters(prev => ({ 
                    ...prev, 
                    dealershipId: e.target.value ? parseInt(e.target.value) : undefined 
                  }))}
                  data-testid="filter-dealership"
                >
                  <option value="">All Dealerships</option>
                  {dealerships.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
                <select
                  className="border rounded-md px-3 py-2 text-sm bg-background"
                  value={userFilters.role || ''}
                  onChange={(e) => setUserFilters(prev => ({ ...prev, role: e.target.value || undefined }))}
                  data-testid="filter-role"
                >
                  <option value="">All Roles</option>
                  <option value="super_admin">Super Admin</option>
                  <option value="master">Master Admin</option>
                  <option value="admin">Admin</option>
                  <option value="manager">Manager</option>
                  <option value="salesperson">Salesperson</option>
                </select>
              </div>
              
              {usersLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading users...</div>
              ) : allUsers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No users found</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Dealership</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allUsers.map((u) => (
                        <TableRow key={u.id} data-testid={`user-row-${u.id}`}>
                          <TableCell className="font-medium">{u.name}</TableCell>
                          <TableCell>{u.email}</TableCell>
                          <TableCell>
                            {u.dealershipName || (u.dealershipId ? `ID: ${u.dealershipId}` : 'N/A')}
                          </TableCell>
                          <TableCell>
                            <Badge variant={
                              u.role === 'super_admin' ? 'default' :
                              u.role === 'master' ? 'default' :
                              u.role === 'admin' ? 'secondary' : 'outline'
                            }>
                              {u.role.replace('_', ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={u.isActive ? "default" : "destructive"}>
                              {u.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              {u.role !== 'super_admin' && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => updateUserStatusMutation.mutate({ 
                                      userId: u.id, 
                                      isActive: !u.isActive 
                                    })}
                                    title={u.isActive ? "Deactivate user" : "Activate user"}
                                    data-testid={`toggle-status-${u.id}`}
                                  >
                                    {u.isActive ? (
                                      <XCircle className="h-4 w-4 text-orange-500" />
                                    ) : (
                                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                                    )}
                                  </Button>
                                  <ResetPasswordDialog 
                                    user={u}
                                    onReset={(newPassword) => resetPasswordMutation.mutate({ 
                                      userId: u.id, 
                                      newPassword 
                                    })}
                                  />
                                  <DeleteUserDialog
                                    user={u}
                                    onDelete={() => deleteUserMutation.mutate(u.id)}
                                  />
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              
              <div className="mt-4 text-sm text-muted-foreground">
                Total: {allUsers.length} user{allUsers.length !== 1 ? 's' : ''}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Onboarding Tab */}
        <TabsContent value="onboarding">
          <OnboardingWizard 
            onComplete={() => {
              queryClient.invalidateQueries({ queryKey: ["/api/super-admin/dealerships"] });
              queryClient.invalidateQueries({ queryKey: ["/api/super-admin/audit-logs"] });
            }} 
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ScrapeSourceRow({ source, onUpdate }: { source: ScrapeSource; onUpdate: () => void }) {
  const { toast } = useToast();

  const handleToggle = async () => {
    const token = localStorage.getItem('auth_token');
    try {
      const response = await fetch(`/api/super-admin/scrape-sources/${source.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ isActive: !source.isActive }),
      });

      if (response.ok) {
        toast({
          title: "Source Updated",
          description: `${source.sourceName} has been ${source.isActive ? 'deactivated' : 'activated'}`,
        });
        onUpdate();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update source",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete "${source.sourceName}"?`)) return;
    
    const token = localStorage.getItem('auth_token');
    try {
      const response = await fetch(`/api/super-admin/scrape-sources/${source.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        toast({
          title: "Source Deleted",
          description: `${source.sourceName} has been removed`,
        });
        onUpdate();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete source",
        variant: "destructive",
      });
    }
  };

  const handleScrapeNow = async () => {
    const token = localStorage.getItem('auth_token');
    try {
      const response = await fetch(`/api/super-admin/scrape-sources/${source.id}/scrape`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        toast({
          title: "Scrape Started",
          description: "Inventory scrape has been initiated in the background",
        });
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.error || "Failed to trigger scrape",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to trigger scrape",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-muted/50 rounded-lg" data-testid={`source-row-${source.id}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{source.sourceName}</span>
          <Badge variant={source.isActive ? "default" : "secondary"}>
            {source.isActive ? "Active" : "Inactive"}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground truncate mt-1">
          <Link2 className="w-3 h-3 inline mr-1" />
          {source.sourceUrl}
        </p>
        <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
          <span>Type: {source.sourceType.replace('_', ' ')}</span>
          <span>Frequency: {source.scrapeFrequency}</span>
          <span>Vehicles: {source.vehicleCount || 0}</span>
          {source.lastScrapedAt && (
            <span>Last scraped: {format(new Date(source.lastScrapedAt), "PPp")}</span>
          )}
        </div>
      </div>
      <div className="flex gap-2 shrink-0">
        <Button variant="outline" size="sm" onClick={handleScrapeNow} data-testid={`button-scrape-${source.id}`}>
          <RefreshCw className="w-4 h-4 mr-1" />
          Scrape Now
        </Button>
        <Button variant="ghost" size="sm" onClick={handleToggle} data-testid={`button-toggle-${source.id}`}>
          {source.isActive ? 'Deactivate' : 'Activate'}
        </Button>
        <Button variant="ghost" size="sm" onClick={handleDelete} className="text-destructive" data-testid={`button-delete-${source.id}`}>
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

function CreateScrapeSourceDialog({ dealerships, onSuccess }: { dealerships: Dealership[]; onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    dealershipId: "",
    sourceName: "",
    sourceUrl: "",
    sourceType: "dealer_website",
    scrapeFrequency: "daily",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.dealershipId) {
      toast({
        title: "Error",
        description: "Please select a dealership",
        variant: "destructive",
      });
      return;
    }
    
    setLoading(true);
    const token = localStorage.getItem('auth_token');

    try {
      const response = await fetch('/api/super-admin/scrape-sources', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...formData,
          dealershipId: parseInt(formData.dealershipId),
        }),
      });

      if (response.ok) {
        toast({
          title: "Source Created",
          description: `${formData.sourceName} has been added successfully`,
        });
        setOpen(false);
        setFormData({
          dealershipId: "",
          sourceName: "",
          sourceUrl: "",
          sourceType: "dealer_website",
          scrapeFrequency: "daily",
        });
        onSuccess();
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.error || "Failed to create source",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create source",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-testid="button-add-source" className="w-full sm:w-auto">
          <Plus className="w-4 h-4 mr-2" />
          Add Source
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Inventory Source</DialogTitle>
          <DialogDescription>
            Add a URL to scrape vehicle inventory from
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="dealershipId">Dealership</Label>
            <select
              id="dealershipId"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              value={formData.dealershipId}
              onChange={(e) => setFormData({ ...formData, dealershipId: e.target.value })}
              required
              data-testid="select-dealership"
            >
              <option value="">Select a dealership</option>
              {dealerships.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="sourceName">Source Name</Label>
            <Input
              id="sourceName"
              value={formData.sourceName}
              onChange={(e) => setFormData({ ...formData, sourceName: e.target.value })}
              placeholder="e.g., Main Dealership, Used Car Lot"
              required
              data-testid="input-source-name"
            />
          </div>
          <div>
            <Label htmlFor="sourceUrl">Source URL</Label>
            <Input
              id="sourceUrl"
              type="url"
              value={formData.sourceUrl}
              onChange={(e) => setFormData({ ...formData, sourceUrl: e.target.value })}
              placeholder="https://www.example.com/inventory"
              required
              data-testid="input-source-url"
            />
          </div>
          <div>
            <Label htmlFor="sourceType">Source Type</Label>
            <select
              id="sourceType"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              value={formData.sourceType}
              onChange={(e) => setFormData({ ...formData, sourceType: e.target.value })}
              data-testid="select-source-type"
            >
              <option value="dealer_website">Dealer Website</option>
              <option value="autotrader">AutoTrader</option>
              <option value="cargurus">CarGurus</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <Label htmlFor="scrapeFrequency">Scrape Frequency</Label>
            <select
              id="scrapeFrequency"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              value={formData.scrapeFrequency}
              onChange={(e) => setFormData({ ...formData, scrapeFrequency: e.target.value })}
              data-testid="select-scrape-frequency"
            >
              <option value="hourly">Hourly</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="manual">Manual Only</option>
            </select>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading} data-testid="button-submit-source">
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              Add Source
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditDealershipDialog({ dealership, onSuccess }: { dealership: Dealership; onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [masterUser, setMasterUser] = useState<{ id: number; email: string; name: string } | null>(null);
  const [formData, setFormData] = useState({
    name: dealership.name,
    slug: dealership.slug,
    subdomain: dealership.subdomain,
    address: dealership.address || "",
    city: dealership.city || "",
    province: dealership.province || "",
    postalCode: dealership.postalCode || "",
    phone: dealership.phone || "",
    timezone: dealership.timezone || "America/Vancouver",
    defaultCurrency: dealership.defaultCurrency || "CAD",
    isActive: dealership.isActive,
    masterAdminEmail: "",
    masterAdminName: "",
    masterAdminPassword: "",
  });

  const fetchDealershipDetails = async () => {
    const token = localStorage.getItem('auth_token');
    try {
      const response = await fetch(`/api/super-admin/dealerships/${dealership.id}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setMasterUser(data.masterUser);
        if (data.masterUser) {
          setFormData(prev => ({
            ...prev,
            masterAdminEmail: data.masterUser.email,
            masterAdminName: data.masterUser.name,
          }));
        }
      }
    } catch (error) {
      console.error("Error fetching dealership details:", error);
    }
  };

  useEffect(() => {
    if (open) {
      fetchDealershipDetails();
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const token = localStorage.getItem('auth_token');
    
    try {
      const response = await fetch(`/api/super-admin/dealerships/${dealership.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.masterUser) {
          setMasterUser(result.masterUser);
        }
        toast({
          title: "Success",
          description: result.masterUser 
            ? `Dealership updated and master admin ${result.masterUser.email} saved successfully`
            : "Dealership updated successfully",
        });
        setFormData(prev => ({ ...prev, masterAdminPassword: "" }));
        setOpen(false);
        onSuccess();
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.error || "Failed to update dealership",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update dealership",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" data-testid={`button-edit-dealership-${dealership.id}`}>
          <Pencil className="h-4 w-4 mr-2" />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Edit Dealership: {dealership.name}</DialogTitle>
          <DialogDescription>
            Update dealership settings and master admin credentials
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <ScrollArea className="h-[60vh] pr-4">
            <div className="space-y-6">
              <div className="space-y-4">
                <h3 className="font-semibold text-lg border-b pb-2">Dealership Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-name">Dealership Name *</Label>
                    <Input
                      id="edit-name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-slug">URL Slug *</Label>
                    <Input
                      id="edit-slug"
                      value={formData.slug}
                      onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-subdomain">Subdomain *</Label>
                    <Input
                      id="edit-subdomain"
                      value={formData.subdomain}
                      onChange={(e) => setFormData({ ...formData, subdomain: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-phone">Phone</Label>
                    <Input
                      id="edit-phone"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>
                  <div className="col-span-2 space-y-2">
                    <Label htmlFor="edit-address">Address</Label>
                    <Input
                      id="edit-address"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-city">City</Label>
                    <Input
                      id="edit-city"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-province">Province</Label>
                    <Input
                      id="edit-province"
                      value={formData.province}
                      onChange={(e) => setFormData({ ...formData, province: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-postalCode">Postal Code</Label>
                    <Input
                      id="edit-postalCode"
                      value={formData.postalCode}
                      onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-timezone">Timezone</Label>
                    <Input
                      id="edit-timezone"
                      value={formData.timezone}
                      onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-2">
                  <Switch
                    id="edit-isActive"
                    checked={formData.isActive}
                    onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                  />
                  <Label htmlFor="edit-isActive">Dealership Active</Label>
                </div>
              </div>
              
              <div className="space-y-4">
                <h3 className="font-semibold text-lg border-b pb-2">General Manager</h3>
                {masterUser && (
                  <div className="bg-muted/50 p-3 rounded-lg mb-4">
                    <p className="text-sm text-muted-foreground">Current General Manager:</p>
                    <p className="font-medium">{masterUser.name} ({masterUser.email})</p>
                  </div>
                )}
                <p className="text-sm text-muted-foreground">
                  {masterUser 
                    ? "Update the password to change credentials for the existing general manager, or enter a new email to create a new general manager."
                    : "Create a new general manager for this dealership by entering email and password."}
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-masterAdminName">Admin Name</Label>
                    <Input
                      id="edit-masterAdminName"
                      value={formData.masterAdminName}
                      onChange={(e) => setFormData({ ...formData, masterAdminName: e.target.value })}
                      placeholder="e.g., John Smith"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-masterAdminEmail">Admin Email</Label>
                    <Input
                      id="edit-masterAdminEmail"
                      type="email"
                      value={formData.masterAdminEmail}
                      onChange={(e) => setFormData({ ...formData, masterAdminEmail: e.target.value })}
                      placeholder="admin@dealership.com"
                    />
                  </div>
                  <div className="col-span-2 space-y-2">
                    <Label htmlFor="edit-masterAdminPassword">Admin Password {masterUser ? "(leave blank to keep current)" : "*"}</Label>
                    <Input
                      id="edit-masterAdminPassword"
                      type="password"
                      value={formData.masterAdminPassword}
                      onChange={(e) => setFormData({ ...formData, masterAdminPassword: e.target.value })}
                      placeholder={masterUser ? "Enter new password or leave blank" : "Enter password"}
                    />
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CreateDealershipDialog({ onSubmit }: { onSubmit: (data: any) => void }) {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    subdomain: "",
    address: "",
    city: "",
    province: "",
    postalCode: "",
    phone: "",
    timezone: "America/Vancouver",
    defaultCurrency: "CAD",
    masterAdminEmail: "",
    masterAdminName: "",
    masterAdminPassword: "",
    // API Keys
    openaiApiKey: "",
    marketcheckKey: "",
    apifyToken: "",
    apifyActorId: "",
    geminiApiKey: "",
    ghlApiKey: "",
    ghlLocationId: "",
    facebookAppId: "",
    facebookAppSecret: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
    setOpen(false);
    setFormData({
      name: "",
      slug: "",
      subdomain: "",
      address: "",
      city: "",
      province: "",
      postalCode: "",
      phone: "",
      timezone: "America/Vancouver",
      defaultCurrency: "CAD",
      masterAdminEmail: "",
      masterAdminName: "",
      masterAdminPassword: "",
      // API Keys
      openaiApiKey: "",
      marketcheckKey: "",
      apifyToken: "",
      apifyActorId: "",
      geminiApiKey: "",
      ghlApiKey: "",
      ghlLocationId: "",
      facebookAppId: "",
      facebookAppSecret: "",
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-testid="button-create-dealership">
          <Plus className="h-4 w-4 mr-2" />
          Create Dealership
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Create New Dealership</DialogTitle>
          <DialogDescription>
            Complete setup questionnaire for a new dealership including master admin, API keys, financing rules, and chat prompts.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <ScrollArea className="h-[60vh] pr-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Dealership Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Olympic Hyundai Vancouver"
                required
                data-testid="input-dealership-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">Slug *</Label>
              <Input
                id="slug"
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                placeholder="olympic-hyundai"
                required
                data-testid="input-dealership-slug"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="subdomain">Subdomain *</Label>
            <Input
              id="subdomain"
              value={formData.subdomain}
              onChange={(e) => setFormData({ ...formData, subdomain: e.target.value })}
              placeholder="olympic"
              required
              data-testid="input-dealership-subdomain"
            />
          </div>
          <div className="border-t pt-4">
            <h4 className="font-medium mb-3">Contact Information</h4>
            <div className="grid grid-cols-2 gap-4 mb-3">
              <div className="col-span-2 space-y-2">
                <Label htmlFor="address">Street Address</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="123 Main Street"
                  data-testid="input-dealership-address"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  placeholder="Vancouver"
                  data-testid="input-dealership-city"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="province">Province</Label>
                <Input
                  id="province"
                  value={formData.province}
                  onChange={(e) => setFormData({ ...formData, province: e.target.value })}
                  placeholder="BC"
                  data-testid="input-dealership-province"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="postalCode">Postal Code</Label>
                <Input
                  id="postalCode"
                  value={formData.postalCode}
                  onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                  placeholder="V6B 5J3"
                  data-testid="input-dealership-postal-code"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="(604) 555-1234"
                  data-testid="input-dealership-phone"
                />
              </div>
            </div>
          </div>
          <div className="border-t pt-4">
            <h4 className="font-medium mb-3">General Manager Account</h4>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="masterAdminName">Name *</Label>
                <Input
                  id="masterAdminName"
                  value={formData.masterAdminName}
                  onChange={(e) => setFormData({ ...formData, masterAdminName: e.target.value })}
                  placeholder="John Smith"
                  required
                  data-testid="input-admin-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="masterAdminEmail">Email *</Label>
                <Input
                  id="masterAdminEmail"
                  type="email"
                  value={formData.masterAdminEmail}
                  onChange={(e) => setFormData({ ...formData, masterAdminEmail: e.target.value })}
                  placeholder="admin@dealership.com"
                  required
                  data-testid="input-admin-email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="masterAdminPassword">Password *</Label>
                <Input
                  id="masterAdminPassword"
                  type="password"
                  value={formData.masterAdminPassword}
                  onChange={(e) => setFormData({ ...formData, masterAdminPassword: e.target.value })}
                  placeholder="Strong password"
                  required
                  data-testid="input-admin-password"
                />
              </div>
            </div>
          </div>
          <div className="border-t pt-4">
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <Key className="h-4 w-4" />
              API Keys & Integration Settings
            </h4>
            <p className="text-sm text-muted-foreground mb-4">
              Configure third-party API keys for this dealership. All fields are optional but required for specific features.
            </p>
            <div className="space-y-4">
              {/* AI & Chat */}
              <div className="space-y-3">
                <h5 className="text-sm font-medium text-foreground">AI & Customer Chat</h5>
                <div className="space-y-2">
                  <Label htmlFor="openaiApiKey">OpenAI API Key</Label>
                  <Input
                    id="openaiApiKey"
                    type="password"
                    value={formData.openaiApiKey}
                    onChange={(e) => setFormData({ ...formData, openaiApiKey: e.target.value })}
                    placeholder="sk-..."
                    data-testid="input-openai-key"
                  />
                  <p className="text-xs text-muted-foreground">For custom AI training & ChatGPT integration</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="geminiApiKey">Google Gemini API Key</Label>
                  <Input
                    id="geminiApiKey"
                    type="password"
                    value={formData.geminiApiKey}
                    onChange={(e) => setFormData({ ...formData, geminiApiKey: e.target.value })}
                    placeholder="AI..."
                    data-testid="input-gemini-key"
                  />
                  <p className="text-xs text-muted-foreground">For video generation with Gemini Veo</p>
                </div>
              </div>
              {/* Market Analysis */}
              <div className="space-y-3">
                <h5 className="text-sm font-medium text-foreground">Market Pricing & Data</h5>
                <div className="space-y-2">
                  <Label htmlFor="marketcheckKey">MarketCheck API Key</Label>
                  <Input
                    id="marketcheckKey"
                    type="password"
                    value={formData.marketcheckKey}
                    onChange={(e) => setFormData({ ...formData, marketcheckKey: e.target.value })}
                    placeholder="Enter MarketCheck API key"
                    data-testid="input-marketcheck-key"
                  />
                  <p className="text-xs text-muted-foreground">For market pricing analysis (primary source)</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="apifyToken">Apify API Token</Label>
                    <Input
                      id="apifyToken"
                      type="password"
                      value={formData.apifyToken}
                      onChange={(e) => setFormData({ ...formData, apifyToken: e.target.value })}
                      placeholder="apify_api_..."
                      data-testid="input-apify-token"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="apifyActorId">Apify Actor ID</Label>
                    <Input
                      id="apifyActorId"
                      value={formData.apifyActorId}
                      onChange={(e) => setFormData({ ...formData, apifyActorId: e.target.value })}
                      placeholder="autotrader-scraper"
                      data-testid="input-apify-actor"
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">For AutoTrader.ca scraping (fallback source)</p>
              </div>
              {/* CRM & Marketing */}
              <div className="space-y-3">
                <h5 className="text-sm font-medium text-foreground">CRM & Marketing Automation</h5>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="ghlApiKey">GoHighLevel API Key</Label>
                    <Input
                      id="ghlApiKey"
                      type="password"
                      value={formData.ghlApiKey}
                      onChange={(e) => setFormData({ ...formData, ghlApiKey: e.target.value })}
                      placeholder="Enter GHL API key"
                      data-testid="input-ghl-key"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ghlLocationId">GHL Location ID</Label>
                    <Input
                      id="ghlLocationId"
                      value={formData.ghlLocationId}
                      onChange={(e) => setFormData({ ...formData, ghlLocationId: e.target.value })}
                      placeholder="Location/Sub-account ID"
                      data-testid="input-ghl-location"
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">For lead management & automation workflows</p>
              </div>
              {/* Facebook */}
              <div className="space-y-3">
                <h5 className="text-sm font-medium text-foreground">Facebook Integration</h5>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="facebookAppId">Facebook App ID</Label>
                    <Input
                      id="facebookAppId"
                      value={formData.facebookAppId}
                      onChange={(e) => setFormData({ ...formData, facebookAppId: e.target.value })}
                      placeholder="Enter App ID"
                      data-testid="input-facebook-app-id"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="facebookAppSecret">Facebook App Secret</Label>
                    <Input
                      id="facebookAppSecret"
                      type="password"
                      value={formData.facebookAppSecret}
                      onChange={(e) => setFormData({ ...formData, facebookAppSecret: e.target.value })}
                      placeholder="Enter App Secret"
                      data-testid="input-facebook-app-secret"
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">For automated Facebook Marketplace posting</p>
              </div>
            </div>
          </div>
          </ScrollArea>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" data-testid="button-submit-dealership">Create Dealership</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AddSettingDialog({ onSubmit }: { onSubmit: (data: any) => void }) {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    key: "",
    value: "",
    description: "",
    isSecret: true,
  });

  const commonSettings = [
    { key: "MARKETCHECK_API_KEY", description: "MarketCheck API key for market pricing analysis" },
    { key: "APIFY_API_KEY", description: "Apify API key for AutoTrader.ca scraping" },
    { key: "GEOCODER_CA_USERNAME", description: "Geocoder.ca username for postal code geocoding" },
    { key: "GEOCODER_CA_PASSWORD", description: "Geocoder.ca password for postal code geocoding" },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
    setOpen(false);
    setFormData({ key: "", value: "", description: "", isSecret: true });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-testid="button-add-setting">
          <Plus className="h-4 w-4 mr-2" />
          Add Setting
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Global Setting</DialogTitle>
          <DialogDescription>Configure a system-wide setting or API key</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="key">Key *</Label>
            <Input
              id="key"
              value={formData.key}
              onChange={(e) => setFormData({ ...formData, key: e.target.value })}
              placeholder="MARKETCHECK_API_KEY"
              required
              data-testid="input-setting-key"
            />
            <div className="flex flex-wrap gap-2 mt-2">
              {commonSettings.map((preset) => (
                <Button
                  key={preset.key}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setFormData({
                      ...formData,
                      key: preset.key,
                      description: preset.description,
                    })
                  }
                  data-testid={`preset-${preset.key}`}
                >
                  {preset.key}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="value">Value *</Label>
            <Input
              id="value"
              value={formData.value}
              onChange={(e) => setFormData({ ...formData, value: e.target.value })}
              placeholder="your-api-key-here"
              type={formData.isSecret ? "password" : "text"}
              required
              data-testid="input-setting-value"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Brief description of this setting"
              data-testid="input-setting-description"
            />
          </div>
          <div className="flex items-center space-x-2">
            <Switch
              id="isSecret"
              checked={formData.isSecret}
              onCheckedChange={(checked) => setFormData({ ...formData, isSecret: checked })}
              data-testid="switch-is-secret"
            />
            <Label htmlFor="isSecret">Secret (hide value by default)</Label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" data-testid="button-submit-setting">Add Setting</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function IntegrationStatus({ label, active }: { label: string; active: boolean }) {
  return (
    <div className={`flex items-center gap-2 p-2 rounded-lg border ${active ? 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800' : 'bg-muted/50 border-border'}`}>
      {active ? (
        <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
      ) : (
        <XCircle className="h-4 w-4 text-muted-foreground" />
      )}
      <span className={`text-sm ${active ? 'text-green-700 dark:text-green-300 font-medium' : 'text-muted-foreground'}`}>
        {label}
      </span>
    </div>
  );
}

interface ExternalToken {
  id: number;
  dealershipId: number;
  tokenName: string;
  tokenPrefix: string;
  permissions: string[];
  lastUsedAt?: string;
  expiresAt?: string;
  isActive: boolean;
  createdAt: string;
}

interface NewTokenResponse {
  id: number;
  tokenName: string;
  rawToken: string;
  tokenPrefix: string;
  permissions: string[];
  expiresAt?: string;
  dealershipId: number;
  message: string;
}

const PERMISSIONS = [
  { value: "import:vehicles", label: "Import Vehicles", description: "Create and update vehicles" },
  { value: "read:vehicles", label: "Read Vehicles", description: "View vehicle inventory" },
  { value: "update:vehicles", label: "Update Vehicles", description: "Modify existing vehicles" },
  { value: "delete:vehicles", label: "Delete Vehicles", description: "Remove vehicles" },
];

function N8nTokensDialog({
  dealershipId,
  dealershipName,
  active,
  tokenCount,
  onSuccess,
}: {
  dealershipId: number;
  dealershipName: string;
  active: boolean;
  tokenCount: number;
  onSuccess: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newToken, setNewToken] = useState<NewTokenResponse | null>(null);
  const [tokenForm, setTokenForm] = useState({
    tokenName: "",
    permissions: ["import:vehicles"] as string[],
  });
  const { toast } = useToast();

  // Fetch tokens for this dealership
  const { data: tokens = [], isLoading, refetch } = useQuery<ExternalToken[]>({
    queryKey: ['external-tokens', dealershipId],
    queryFn: async () => {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/external-tokens?dealershipId=${dealershipId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch tokens');
      return response.json();
    },
    enabled: open
  });

  const createTokenMutation = useMutation({
    mutationFn: async (data: typeof tokenForm) => {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/external-tokens', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ ...data, dealershipId })
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create token');
      }
      return response.json();
    },
    onSuccess: (data: NewTokenResponse) => {
      setNewToken(data);
      setCreateDialogOpen(false);
      refetch();
      onSuccess();
      setTokenForm({ tokenName: "", permissions: ["import:vehicles"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const deleteTokenMutation = useMutation({
    mutationFn: async (id: number) => {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/external-tokens/${id}?dealershipId=${dealershipId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete token');
      }
    },
    onSuccess: () => {
      refetch();
      onSuccess();
      toast({ title: "Success", description: "Token deleted successfully" });
    }
  });

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied!", description: `${label} copied to clipboard` });
  };

  const togglePermission = (perm: string) => {
    setTokenForm(prev => ({
      ...prev,
      permissions: prev.permissions.includes(perm)
        ? prev.permissions.filter(p => p !== perm)
        : [...prev.permissions, perm]
    }));
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer hover:border-primary/50 transition-colors ${active ? 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800' : 'bg-muted/50 border-border'}`}
        data-testid={`n8n-config-${dealershipId}`}
      >
        {active ? (
          <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
        ) : (
          <XCircle className="h-4 w-4 text-muted-foreground" />
        )}
        <span className={`text-sm ${active ? 'text-green-700 dark:text-green-300 font-medium' : 'text-muted-foreground'}`}>
          n8n {tokenCount > 0 && `(${tokenCount})`}
        </span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Webhook className="h-5 w-5" />
              n8n Integration - {dealershipName}
            </DialogTitle>
            <DialogDescription>
              Manage API tokens for n8n workflows and other automation tools
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">
                {tokens.length} active token{tokens.length !== 1 ? 's' : ''}
              </span>
              <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" data-testid="button-create-n8n-token">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Token
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create API Token</DialogTitle>
                    <DialogDescription>
                      This token will allow external services to access {dealershipName}'s vehicle data
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div>
                      <Label htmlFor="tokenName">Token Name</Label>
                      <Input
                        id="tokenName"
                        placeholder="n8n Scraper"
                        value={tokenForm.tokenName}
                        onChange={(e) => setTokenForm({ ...tokenForm, tokenName: e.target.value })}
                        data-testid="input-n8n-token-name"
                      />
                    </div>
                    <div>
                      <Label>Permissions</Label>
                      <div className="space-y-2 mt-2">
                        {PERMISSIONS.map((perm) => (
                          <div key={perm.value} className="flex items-start gap-3 p-2 border rounded-lg">
                            <Checkbox
                              id={perm.value}
                              checked={tokenForm.permissions.includes(perm.value)}
                              onCheckedChange={() => togglePermission(perm.value)}
                            />
                            <div>
                              <Label htmlFor={perm.value} className="font-medium cursor-pointer">
                                {perm.label}
                              </Label>
                              <p className="text-xs text-muted-foreground">{perm.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      onClick={() => createTokenMutation.mutate(tokenForm)}
                      disabled={!tokenForm.tokenName || tokenForm.permissions.length === 0 || createTokenMutation.isPending}
                      data-testid="button-save-n8n-token"
                    >
                      Create Token
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {isLoading ? (
              <div className="text-center py-8">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
              </div>
            ) : tokens.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                <Webhook className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No API tokens created yet</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {tokens.map((token) => (
                  <div
                    key={token.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                    data-testid={`n8n-token-item-${token.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium flex items-center gap-2">
                        {token.tokenName}
                        <Badge variant={token.isActive ? "default" : "secondary"} className="text-xs">
                          {token.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Prefix: <code className="bg-muted px-1 rounded text-xs">{token.tokenPrefix}...</code>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {token.permissions.map((perm) => (
                          <Badge key={perm} variant="outline" className="text-xs">
                            {perm}
                          </Badge>
                        ))}
                      </div>
                      {token.lastUsedAt && (
                        <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Last used: {format(new Date(token.lastUsedAt), "PPp")}
                        </div>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteTokenMutation.mutate(token.id)}
                      disabled={deleteTokenMutation.isPending}
                      data-testid={`button-delete-n8n-token-${token.id}`}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* New Token Created Dialog */}
      <Dialog open={!!newToken} onOpenChange={(open) => !open && setNewToken(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-5 w-5" />
              Token Created Successfully
            </DialogTitle>
            <DialogDescription>
              Copy this token now - you won't be able to see it again!
            </DialogDescription>
          </DialogHeader>
          {newToken && (
            <div className="py-4">
              <div className="bg-muted p-4 rounded-lg">
                <div className="flex items-center justify-between gap-2">
                  <code className="text-sm break-all flex-1">{newToken.rawToken}</code>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(newToken.rawToken, "API Token")}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="mt-4 p-3 bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800 rounded-lg flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-orange-500 shrink-0 mt-0.5" />
                <p className="text-sm text-orange-700 dark:text-orange-300">
                  Make sure to save this token. For security reasons, you won't be able to see it again.
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setNewToken(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function EditApiKeysDialog({ 
  dealershipId, 
  dealershipName,
  onSuccess 
}: { 
  dealershipId: number; 
  dealershipName: string;
  onSuccess: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [testing, setTesting] = useState<{ 
    openai: boolean; 
    facebook: boolean; 
    ghl: boolean; 
    marketcheck: boolean; 
    apify: boolean;
  }>({ openai: false, facebook: false, ghl: false, marketcheck: false, apify: false });
  const [testResults, setTestResults] = useState<{ 
    openai?: { success: boolean; message: string }; 
    facebook?: { success: boolean; message: string };
    ghl?: { success: boolean; message: string };
    marketcheck?: { success: boolean; message: string };
    apify?: { success: boolean; message: string };
  }>({});
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({
    openaiApiKey: "",
    facebookAppId: "",
    facebookAppSecret: "",
    marketcheckKey: "",
    apifyToken: "",
    apifyActorId: "",
    geminiApiKey: "",
    ghlApiKey: "",
    ghlLocationId: "",
    gtmContainerId: "",
    googleAnalyticsId: "",
    googleAdsId: "",
    facebookPixelId: "",
  });

  const { data: apiKeys, isLoading } = useQuery<DealershipApiKeys>({
    queryKey: [`/api/super-admin/dealerships/${dealershipId}/api-keys`],
    enabled: open,
  });

  useEffect(() => {
    if (apiKeys) {
      setFormData({
        openaiApiKey: apiKeys.openaiApiKey || "",
        facebookAppId: apiKeys.facebookAppId || "",
        facebookAppSecret: apiKeys.facebookAppSecret || "",
        marketcheckKey: apiKeys.marketcheckKey || "",
        apifyToken: apiKeys.apifyToken || "",
        apifyActorId: apiKeys.apifyActorId || "",
        geminiApiKey: apiKeys.geminiApiKey || "",
        ghlApiKey: apiKeys.ghlApiKey || "",
        ghlLocationId: apiKeys.ghlLocationId || "",
        gtmContainerId: apiKeys.gtmContainerId || "",
        googleAnalyticsId: apiKeys.googleAnalyticsId || "",
        googleAdsId: apiKeys.googleAdsId || "",
        facebookPixelId: apiKeys.facebookPixelId || "",
      });
    }
  }, [apiKeys]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/super-admin/dealerships/${dealershipId}/api-keys`, {
        method: "PATCH",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update API keys");
      }
      
      toast({ title: "Success", description: "API keys updated successfully" });
      onSuccess();
      setOpen(false);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const testOpenAI = async () => {
    setTesting({ ...testing, openai: true });
    setTestResults({ ...testResults, openai: undefined });
    
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/super-admin/dealerships/${dealershipId}/test-openai`, {
        method: "POST",
        headers: { 
          "Authorization": `Bearer ${token}`,
        },
      });
      const result = await response.json();
      setTestResults({ ...testResults, openai: { success: result.success, message: result.message || result.error } });
    } catch (error) {
      setTestResults({ ...testResults, openai: { success: false, message: "Connection failed" } });
    } finally {
      setTesting({ ...testing, openai: false });
    }
  };

  const testFacebook = async () => {
    setTesting({ ...testing, facebook: true });
    setTestResults({ ...testResults, facebook: undefined });
    
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/super-admin/dealerships/${dealershipId}/test-facebook`, {
        method: "POST",
        headers: { 
          "Authorization": `Bearer ${token}`,
        },
      });
      const result = await response.json();
      setTestResults({ ...testResults, facebook: { success: result.success, message: result.message || result.error } });
    } catch (error) {
      setTestResults({ ...testResults, facebook: { success: false, message: "Connection failed" } });
    } finally {
      setTesting({ ...testing, facebook: false });
    }
  };

  const testGHL = async () => {
    setTesting({ ...testing, ghl: true });
    setTestResults({ ...testResults, ghl: undefined });
    
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/super-admin/dealerships/${dealershipId}/test-ghl`, {
        method: "POST",
        headers: { 
          "Authorization": `Bearer ${token}`,
        },
      });
      const result = await response.json();
      setTestResults({ ...testResults, ghl: { success: result.success, message: result.message || result.error } });
    } catch (error) {
      setTestResults({ ...testResults, ghl: { success: false, message: "Connection failed" } });
    } finally {
      setTesting({ ...testing, ghl: false });
    }
  };

  const testMarketCheck = async () => {
    setTesting({ ...testing, marketcheck: true });
    setTestResults({ ...testResults, marketcheck: undefined });
    
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/super-admin/dealerships/${dealershipId}/test-marketcheck`, {
        method: "POST",
        headers: { 
          "Authorization": `Bearer ${token}`,
        },
      });
      const result = await response.json();
      setTestResults({ ...testResults, marketcheck: { success: result.success, message: result.message || result.error } });
    } catch (error) {
      setTestResults({ ...testResults, marketcheck: { success: false, message: "Connection failed" } });
    } finally {
      setTesting({ ...testing, marketcheck: false });
    }
  };

  const testApify = async () => {
    setTesting({ ...testing, apify: true });
    setTestResults({ ...testResults, apify: undefined });
    
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/super-admin/dealerships/${dealershipId}/test-apify`, {
        method: "POST",
        headers: { 
          "Authorization": `Bearer ${token}`,
        },
      });
      const result = await response.json();
      setTestResults({ ...testResults, apify: { success: result.success, message: result.message || result.error } });
    } catch (error) {
      setTestResults({ ...testResults, apify: { success: false, message: "Connection failed" } });
    } finally {
      setTesting({ ...testing, apify: false });
    }
  };

  const toggleSecret = (key: string) => {
    setShowSecrets({ ...showSecrets, [key]: !showSecrets[key] });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" data-testid={`button-edit-api-keys-${dealershipId}`}>
          <Settings2 className="h-4 w-4 mr-2" />
          Configure
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>API Keys - {dealershipName}</DialogTitle>
          <DialogDescription>
            Configure API keys and integration settings for this dealership
          </DialogDescription>
        </DialogHeader>
        
        {isLoading ? (
          <div className="text-center py-8">
            <Loader2 className="h-6 w-6 animate-spin mx-auto" />
            <p className="text-muted-foreground mt-2">Loading API keys...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <ScrollArea className="h-[60vh] pr-4">
              <div className="space-y-6">
                {/* AI Integration */}
                <div className="border rounded-lg p-4">
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    🤖 AI Integration (OpenAI ChatGPT)
                  </h4>
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="openaiApiKey">OpenAI API Key</Label>
                      <div className="flex gap-2">
                        <Input
                          id="openaiApiKey"
                          value={formData.openaiApiKey}
                          onChange={(e) => setFormData({ ...formData, openaiApiKey: e.target.value })}
                          placeholder="sk-..."
                          type={showSecrets.openaiApiKey ? "text" : "password"}
                          className="flex-1"
                          data-testid="input-openai-api-key"
                        />
                        <Button type="button" variant="ghost" size="icon" onClick={() => toggleSecret('openaiApiKey')}>
                          {showSecrets.openaiApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                        <Button 
                          type="button" 
                          variant="outline" 
                          onClick={testOpenAI}
                          disabled={testing.openai || !formData.openaiApiKey}
                          data-testid="button-test-openai"
                        >
                          {testing.openai ? <Loader2 className="h-4 w-4 animate-spin" /> : "Test"}
                        </Button>
                      </div>
                      {testResults.openai && (
                        <p className={`text-sm ${testResults.openai.success ? 'text-green-600' : 'text-red-600'}`}>
                          {testResults.openai.success ? '✓ ' : '✗ '}{testResults.openai.message}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">Used for the AI chat assistant on vehicle pages</p>
                    </div>
                  </div>
                </div>

                {/* Facebook Integration */}
                <div className="border rounded-lg p-4">
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    📘 Facebook Marketplace Automation
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="facebookAppId">Facebook App ID</Label>
                      <Input
                        id="facebookAppId"
                        value={formData.facebookAppId}
                        onChange={(e) => setFormData({ ...formData, facebookAppId: e.target.value })}
                        placeholder="123456789..."
                        data-testid="input-facebook-app-id"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="facebookAppSecret">Facebook App Secret</Label>
                      <div className="flex gap-2">
                        <Input
                          id="facebookAppSecret"
                          value={formData.facebookAppSecret}
                          onChange={(e) => setFormData({ ...formData, facebookAppSecret: e.target.value })}
                          placeholder="abc123..."
                          type={showSecrets.facebookAppSecret ? "text" : "password"}
                          className="flex-1"
                          data-testid="input-facebook-app-secret"
                        />
                        <Button type="button" variant="ghost" size="icon" onClick={() => toggleSecret('facebookAppSecret')}>
                          {showSecrets.facebookAppSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                    <div className="col-span-full">
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={testFacebook}
                        disabled={testing.facebook || !formData.facebookAppId || !formData.facebookAppSecret}
                        data-testid="button-test-facebook"
                      >
                        {testing.facebook ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Test Facebook Credentials
                      </Button>
                      {testResults.facebook && (
                        <p className={`text-sm mt-2 ${testResults.facebook.success ? 'text-green-600' : 'text-red-600'}`}>
                          {testResults.facebook.success ? '✓ ' : '✗ '}{testResults.facebook.message}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">Required for automated Facebook Marketplace posting</p>
                    </div>
                    
                    {/* Facebook OAuth Info Section */}
                    <div className="col-span-full border-t pt-4 mt-2">
                      <div className="mb-3">
                        <h5 className="font-medium text-sm mb-2">Facebook Page Connection</h5>
                        <p className="text-xs text-muted-foreground">
                          Once you save the Facebook App ID and Secret above, dealership staff can connect 
                          their Facebook accounts from the Sales Dashboard to post vehicles to their pages.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Remarketing / Analytics */}
                <div className="border rounded-lg p-4">
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    📊 Analytics & Remarketing
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="gtmContainerId">GTM Container ID</Label>
                      <Input
                        id="gtmContainerId"
                        value={formData.gtmContainerId}
                        onChange={(e) => setFormData({ ...formData, gtmContainerId: e.target.value })}
                        placeholder="GTM-XXXXX"
                        data-testid="input-gtm-container-id"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="googleAnalyticsId">Google Analytics 4 ID</Label>
                      <Input
                        id="googleAnalyticsId"
                        value={formData.googleAnalyticsId}
                        onChange={(e) => setFormData({ ...formData, googleAnalyticsId: e.target.value })}
                        placeholder="G-XXXXX"
                        data-testid="input-google-analytics-id"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="googleAdsId">Google Ads ID</Label>
                      <Input
                        id="googleAdsId"
                        value={formData.googleAdsId}
                        onChange={(e) => setFormData({ ...formData, googleAdsId: e.target.value })}
                        placeholder="AW-XXXXX"
                        data-testid="input-google-ads-id"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="facebookPixelId">Facebook Pixel ID</Label>
                      <Input
                        id="facebookPixelId"
                        value={formData.facebookPixelId}
                        onChange={(e) => setFormData({ ...formData, facebookPixelId: e.target.value })}
                        placeholder="123456789..."
                        data-testid="input-facebook-pixel-id"
                      />
                    </div>
                  </div>
                </div>

                {/* Market Data APIs */}
                <div className="border rounded-lg p-4">
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    🔍 Market Data APIs
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="marketcheckKey">MarketCheck API Key</Label>
                      <div className="flex gap-2">
                        <Input
                          id="marketcheckKey"
                          value={formData.marketcheckKey}
                          onChange={(e) => setFormData({ ...formData, marketcheckKey: e.target.value })}
                          placeholder="API key..."
                          type={showSecrets.marketcheckKey ? "text" : "password"}
                          className="flex-1"
                          data-testid="input-marketcheck-key"
                        />
                        <Button type="button" variant="ghost" size="icon" onClick={() => toggleSecret('marketcheckKey')}>
                          {showSecrets.marketcheckKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                        <Button 
                          type="button" 
                          variant="outline" 
                          onClick={testMarketCheck}
                          disabled={testing.marketcheck || !formData.marketcheckKey}
                          data-testid="button-test-marketcheck"
                        >
                          {testing.marketcheck ? <Loader2 className="h-4 w-4 animate-spin" /> : "Test"}
                        </Button>
                      </div>
                      {testResults.marketcheck && (
                        <p className={`text-sm ${testResults.marketcheck.success ? 'text-green-600' : 'text-red-600'}`}>
                          {testResults.marketcheck.success ? '✓ ' : '✗ '}{testResults.marketcheck.message}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="apifyToken">Apify API Token</Label>
                      <div className="flex gap-2">
                        <Input
                          id="apifyToken"
                          value={formData.apifyToken}
                          onChange={(e) => setFormData({ ...formData, apifyToken: e.target.value })}
                          placeholder="apify_api_..."
                          type={showSecrets.apifyToken ? "text" : "password"}
                          className="flex-1"
                          data-testid="input-apify-token"
                        />
                        <Button type="button" variant="ghost" size="icon" onClick={() => toggleSecret('apifyToken')}>
                          {showSecrets.apifyToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                        <Button 
                          type="button" 
                          variant="outline" 
                          onClick={testApify}
                          disabled={testing.apify || !formData.apifyToken}
                          data-testid="button-test-apify"
                        >
                          {testing.apify ? <Loader2 className="h-4 w-4 animate-spin" /> : "Test"}
                        </Button>
                      </div>
                      {testResults.apify && (
                        <p className={`text-sm ${testResults.apify.success ? 'text-green-600' : 'text-red-600'}`}>
                          {testResults.apify.success ? '✓ ' : '✗ '}{testResults.apify.message}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="apifyActorId">Apify Actor ID</Label>
                      <Input
                        id="apifyActorId"
                        value={formData.apifyActorId}
                        onChange={(e) => setFormData({ ...formData, apifyActorId: e.target.value })}
                        placeholder="Actor ID..."
                        data-testid="input-apify-actor-id"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="geminiApiKey">Google Gemini API Key</Label>
                      <div className="flex gap-2">
                        <Input
                          id="geminiApiKey"
                          value={formData.geminiApiKey}
                          onChange={(e) => setFormData({ ...formData, geminiApiKey: e.target.value })}
                          placeholder="API key..."
                          type={showSecrets.geminiApiKey ? "text" : "password"}
                          className="flex-1"
                          data-testid="input-gemini-api-key"
                        />
                        <Button type="button" variant="ghost" size="icon" onClick={() => toggleSecret('geminiApiKey')}>
                          {showSecrets.geminiApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* GoHighLevel CRM */}
                <div className="border rounded-lg p-4">
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    📞 GoHighLevel CRM
                  </h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    Connect to sync website chat conversations and leads to your CRM
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="ghlApiKey">GHL API Key</Label>
                      <div className="flex gap-2">
                        <Input
                          id="ghlApiKey"
                          value={formData.ghlApiKey}
                          onChange={(e) => setFormData({ ...formData, ghlApiKey: e.target.value })}
                          placeholder="API key..."
                          type={showSecrets.ghlApiKey ? "text" : "password"}
                          className="flex-1"
                          data-testid="input-ghl-api-key"
                        />
                        <Button type="button" variant="ghost" size="icon" onClick={() => toggleSecret('ghlApiKey')}>
                          {showSecrets.ghlApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ghlLocationId">GHL Location ID</Label>
                      <Input
                        id="ghlLocationId"
                        value={formData.ghlLocationId}
                        onChange={(e) => setFormData({ ...formData, ghlLocationId: e.target.value })}
                        placeholder="Location ID..."
                        data-testid="input-ghl-location-id"
                      />
                    </div>
                    <div className="col-span-full">
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={testGHL}
                        disabled={testing.ghl || !formData.ghlApiKey || !formData.ghlLocationId}
                        data-testid="button-test-ghl"
                      >
                        {testing.ghl ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Test GHL Connection
                      </Button>
                      {testResults.ghl && (
                        <p className={`text-sm mt-2 ${testResults.ghl.success ? 'text-green-600' : 'text-red-600'}`}>
                          {testResults.ghl.success ? '✓ ' : '✗ '}{testResults.ghl.message}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </ScrollArea>
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" data-testid="button-save-api-keys">
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Delete User Dialog Component
function DeleteUserDialog({ user, onDelete }: { user: UserWithDealership; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  
  const handleDelete = () => {
    onDelete();
    setOpen(false);
    setConfirmText('');
  };
  
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" title="Delete user" data-testid={`delete-user-${user.id}`}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete User</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this user? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="p-4 border rounded-lg bg-muted">
            <p className="font-medium">{user.name}</p>
            <p className="text-sm text-muted-foreground">{user.email}</p>
            <p className="text-sm text-muted-foreground">
              {user.dealershipName || 'No dealership'} • {user.role.replace('_', ' ')}
            </p>
          </div>
          <div>
            <Label htmlFor="confirm">Type "DELETE" to confirm</Label>
            <Input
              id="confirm"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="DELETE"
              data-testid="input-confirm-delete"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button 
            variant="destructive" 
            onClick={handleDelete}
            disabled={confirmText !== 'DELETE'}
            data-testid="button-confirm-delete"
          >
            Delete User
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Reset Password Dialog Component
function ResetPasswordDialog({ user, onReset }: { user: UserWithDealership; onReset: (newPassword: string) => void }) {
  const [open, setOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const handleReset = () => {
    if (newPassword.length >= 6) {
      onReset(newPassword);
      setOpen(false);
      setNewPassword('');
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" title="Reset password" data-testid={`reset-password-${user.id}`}>
          <KeyRound className="h-4 w-4 text-blue-500" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset Password</DialogTitle>
          <DialogDescription>
            Set a new password for {user.name} ({user.email})
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="newPassword">New Password</Label>
            <div className="flex gap-2">
              <Input
                id="newPassword"
                type={showPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password (min 6 chars)"
                className="flex-1"
                data-testid="input-new-password"
              />
              <Button 
                type="button" 
                variant="ghost" 
                size="icon"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            {newPassword.length > 0 && newPassword.length < 6 && (
              <p className="text-sm text-destructive mt-1">Password must be at least 6 characters</p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleReset}
            disabled={newPassword.length < 6}
            data-testid="button-reset-password"
          >
            Reset Password
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
