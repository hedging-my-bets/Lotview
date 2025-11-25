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
import { useToast } from "@/hooks/use-toast";
import { Building2, Key, FileText, Plus, Eye, EyeOff, Trash2 } from "lucide-react";
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
      masterAdminEmail: string;
      masterAdminName: string;
      masterAdminPassword: string;
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
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Super Admin Dashboard</h1>
        <p className="text-muted-foreground">System-wide administration and configuration</p>
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
    masterAdminEmail: "",
    masterAdminName: "",
    masterAdminPassword: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
    setOpen(false);
    setFormData({
      name: "",
      slug: "",
      subdomain: "",
      masterAdminEmail: "",
      masterAdminName: "",
      masterAdminPassword: "",
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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create New Dealership</DialogTitle>
          <DialogDescription>
            Create a new dealership with full setup including master admin, financing rules, and chat prompts.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
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
