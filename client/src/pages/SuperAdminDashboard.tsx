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
import { Building2, Key, FileText, Plus, Eye, EyeOff, Trash2, LogOut } from "lucide-react";
import { format } from "date-fns";

interface Dealership {
  id: number;
  name: string;
  slug: string;
  subdomain: string;
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
    <div className="container mx-auto p-6" data-testid="super-admin-dashboard">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Super Admin Dashboard</h1>
          <p className="text-muted-foreground">System-wide administration and configuration</p>
        </div>
        <Button onClick={handleLogout} variant="outline" data-testid="button-logout">
          <LogOut className="w-4 h-4 mr-2" />
          Logout
        </Button>
      </div>

      <Tabs defaultValue="dealerships" className="space-y-4">
        <TabsList>
          <TabsTrigger value="dealerships" data-testid="tab-dealerships">
            <Building2 className="h-4 w-4 mr-2" />
            Dealerships
          </TabsTrigger>
          <TabsTrigger value="settings" data-testid="tab-settings">
            <Key className="h-4 w-4 mr-2" />
            Global Settings
          </TabsTrigger>
          <TabsTrigger value="audit" data-testid="tab-audit">
            <FileText className="h-4 w-4 mr-2" />
            Audit Logs
          </TabsTrigger>
        </TabsList>

        {/* Dealerships Tab */}
        <TabsContent value="dealerships">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
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
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Slug</TableHead>
                      <TableHead>Subdomain</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
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
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Global Settings Tab */}
        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
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
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
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
            <h4 className="font-medium mb-3">Master Admin Account</h4>
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
