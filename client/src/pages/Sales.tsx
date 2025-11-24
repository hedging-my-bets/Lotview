import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { LogOut, Facebook, Plus, Trash2, Edit, FileText, ListOrdered, Calendar, Clock, GripVertical, Car } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

type FacebookAccount = {
  id: number;
  accountName: string;
  facebookUserId?: string;
  isActive: boolean;
  tokenExpiresAt?: string;
  createdAt: string;
};

type AdTemplate = {
  id: number;
  templateName: string;
  titleTemplate: string;
  descriptionTemplate: string;
  isDefault: boolean;
  createdAt: string;
};

type PostingSchedule = {
  id: number;
  startTime: string;
  intervalMinutes: number;
  isActive: boolean;
};

type Vehicle = {
  id: number;
  year: number;
  make: string;
  model: string;
  trim?: string;
  price: number;
  imageUrl?: string;
  odometer: number;
};

type QueueItem = {
  id: number;
  vehicleId: number;
  facebookAccountId?: number;
  templateId?: number;
  queueOrder: number;
  status: string;
  vehicle?: Vehicle;
  facebookAccount?: FacebookAccount;
  template?: AdTemplate;
};

export default function Sales() {
  const [, setLocation] = useLocation();
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [addToQueueDialogOpen, setAddToQueueDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<FacebookAccount | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<AdTemplate | null>(null);
  const [draggedItem, setDraggedItem] = useState<number | null>(null);

  const [accountForm, setAccountForm] = useState({ accountName: "" });
  const [templateForm, setTemplateForm] = useState({ 
    templateName: "", 
    titleTemplate: "", 
    descriptionTemplate: "",
    isDefault: false
  });
  const [scheduleForm, setScheduleForm] = useState({
    startTime: "09:00",
    intervalMinutes: 60,
    isActive: false
  });
  const [queueForm, setQueueForm] = useState({
    vehicleId: 0,
    facebookAccountId: 0,
    templateId: 0
  });

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
      
      if (parsedUser.role !== 'salesperson') {
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

  const { data: accounts = [], isLoading: accountsLoading } = useQuery<FacebookAccount[]>({
    queryKey: ['facebook-accounts'],
    queryFn: async () => {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/facebook/accounts', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch accounts');
      return response.json();
    },
    enabled: !!user
  });

  const { data: templates = [], isLoading: templatesLoading } = useQuery<AdTemplate[]>({
    queryKey: ['ad-templates'],
    queryFn: async () => {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/facebook/templates', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch templates');
      return response.json();
    },
    enabled: !!user
  });

  const { data: schedule } = useQuery<PostingSchedule>({
    queryKey: ['posting-schedule'],
    queryFn: async () => {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/facebook/schedule', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch schedule');
      return response.json();
    },
    enabled: !!user
  });

  useEffect(() => {
    if (schedule) {
      setScheduleForm({
        startTime: schedule.startTime,
        intervalMinutes: schedule.intervalMinutes,
        isActive: schedule.isActive
      });
    }
  }, [schedule]);

  const createAccountMutation = useMutation({
    mutationFn: async (data: typeof accountForm) => {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/facebook/accounts', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data)
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create account');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facebook-accounts'] });
      setAccountDialogOpen(false);
      setAccountForm({ accountName: "" });
      toast({ title: "Success", description: "Facebook account added successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const deleteAccountMutation = useMutation({
    mutationFn: async (id: number) => {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/facebook/accounts/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to delete account');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facebook-accounts'] });
      toast({ title: "Success", description: "Facebook account deleted" });
    }
  });

  const createTemplateMutation = useMutation({
    mutationFn: async (data: typeof templateForm) => {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/facebook/templates', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data)
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create template');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ad-templates'] });
      setTemplateDialogOpen(false);
      setTemplateForm({ templateName: "", titleTemplate: "", descriptionTemplate: "", isDefault: false });
      toast({ title: "Success", description: "Ad template created successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: number) => {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/facebook/templates/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to delete template');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ad-templates'] });
      toast({ title: "Success", description: "Template deleted" });
    }
  });

  const saveScheduleMutation = useMutation({
    mutationFn: async (data: typeof scheduleForm) => {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/facebook/schedule', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data)
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save schedule');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posting-schedule'] });
      toast({ title: "Success", description: "Posting schedule saved successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const { data: vehicles = [], isLoading: vehiclesLoading } = useQuery<Vehicle[]>({
    queryKey: ['vehicles'],
    queryFn: async () => {
      const response = await fetch('/api/vehicles');
      if (!response.ok) throw new Error('Failed to fetch vehicles');
      return response.json();
    }
  });

  const { data: queueItems = [], isLoading: queueLoading } = useQuery<QueueItem[]>({
    queryKey: ['posting-queue'],
    queryFn: async () => {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/facebook/queue', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch queue');
      return response.json();
    }
  });

  const addToQueueMutation = useMutation({
    mutationFn: async (data: { vehicleId: number; facebookAccountId?: number; templateId?: number }) => {
      const token = localStorage.getItem('auth_token');
      const maxOrder = Math.max(0, ...queueItems.map(item => item.queueOrder));
      
      const payload: any = {
        vehicleId: data.vehicleId,
        queueOrder: maxOrder + 1,
        status: 'queued'
      };
      
      if (data.facebookAccountId && data.facebookAccountId > 0) {
        payload.facebookAccountId = data.facebookAccountId;
      }
      
      if (data.templateId && data.templateId > 0) {
        payload.templateId = data.templateId;
      }
      
      const response = await fetch('/api/facebook/queue', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add to queue');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posting-queue'] });
      setAddToQueueDialogOpen(false);
      setQueueForm({ vehicleId: 0, facebookAccountId: 0, templateId: 0 });
      toast({ title: "Success", description: "Vehicle added to posting queue" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const updateQueueMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: number; queueOrder?: number; facebookAccountId?: number; templateId?: number }) => {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/facebook/queue/${id}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to update queue item');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posting-queue'] });
    }
  });

  const deleteFromQueueMutation = useMutation({
    mutationFn: async (id: number) => {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/facebook/queue/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to remove from queue');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posting-queue'] });
      toast({ title: "Success", description: "Vehicle removed from queue" });
    }
  });

  const handleDragStart = (id: number) => {
    setDraggedItem(id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (targetId: number) => {
    if (draggedItem === null || draggedItem === targetId) return;
    
    const originalOrders = new Map(queueItems.map(item => [item.id, item.queueOrder]));
    const currentItems = JSON.parse(JSON.stringify(queueItems));
    const draggedIndex = currentItems.findIndex((item: QueueItem) => item.id === draggedItem);
    const targetIndex = currentItems.findIndex((item: QueueItem) => item.id === targetId);
    
    if (draggedIndex === -1 || targetIndex === -1) return;

    const reorderedItems = [...currentItems];
    const [removed] = reorderedItems.splice(draggedIndex, 1);
    reorderedItems.splice(targetIndex, 0, removed);

    const updatedItems = reorderedItems.map((item: QueueItem, index: number) => ({
      ...item,
      queueOrder: index + 1
    }));

    queryClient.setQueryData(['posting-queue'], updatedItems);

    updatedItems.forEach((item: QueueItem) => {
      const originalOrder = originalOrders.get(item.id);
      if (originalOrder !== undefined && originalOrder !== item.queueOrder) {
        updateQueueMutation.mutate({ id: item.id, queueOrder: item.queueOrder });
      }
    });

    setDraggedItem(null);
  };

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
    setLocation('/login');
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
              <h1 className="text-3xl font-bold text-slate-900 mb-2">Salesperson Dashboard</h1>
              <p className="text-slate-600">Welcome back, {user?.name}</p>
            </div>
            <Button onClick={handleLogout} variant="outline" data-testid="button-logout">
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>

          <Tabs defaultValue="accounts" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="accounts">
                <Facebook className="w-4 h-4 mr-2" />
                Accounts
              </TabsTrigger>
              <TabsTrigger value="templates">
                <FileText className="w-4 h-4 mr-2" />
                Templates
              </TabsTrigger>
              <TabsTrigger value="queue">
                <ListOrdered className="w-4 h-4 mr-2" />
                Queue
              </TabsTrigger>
              <TabsTrigger value="schedule">
                <Calendar className="w-4 h-4 mr-2" />
                Schedule
              </TabsTrigger>
            </TabsList>

            <TabsContent value="accounts" className="mt-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Facebook Accounts</CardTitle>
                      <CardDescription>
                        Connect up to 5 Facebook accounts for marketplace posting ({accounts.length}/5 used)
                      </CardDescription>
                    </div>
                    <Dialog open={accountDialogOpen} onOpenChange={setAccountDialogOpen}>
                      <DialogTrigger asChild>
                        <Button 
                          disabled={accounts.length >= 5}
                          data-testid="button-add-account"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Add Account
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Add Facebook Account</DialogTitle>
                          <DialogDescription>
                            Enter a name for this Facebook account. You'll connect it later.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div>
                            <Label htmlFor="accountName">Account Name</Label>
                            <Input
                              id="accountName"
                              placeholder="My Facebook Account"
                              value={accountForm.accountName}
                              onChange={(e) => setAccountForm({ accountName: e.target.value })}
                              data-testid="input-account-name"
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button
                            onClick={() => createAccountMutation.mutate(accountForm)}
                            disabled={!accountForm.accountName || createAccountMutation.isPending}
                            data-testid="button-save-account"
                          >
                            Add Account
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>
                <CardContent>
                  {accountsLoading ? (
                    <div className="text-center py-8">
                      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                    </div>
                  ) : accounts.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                      No Facebook accounts connected yet. Add your first account to get started.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {accounts.map((account) => (
                        <div
                          key={account.id}
                          className="flex items-center justify-between p-4 border rounded-lg bg-white"
                          data-testid={`account-item-${account.id}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                              <Facebook className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                              <div className="font-medium">{account.accountName}</div>
                              <div className="text-sm text-slate-500">
                                Added {new Date(account.createdAt).toLocaleDateString()}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={account.isActive ? "default" : "secondary"}>
                              {account.isActive ? "Active" : "Inactive"}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteAccountMutation.mutate(account.id)}
                              data-testid={`button-delete-account-${account.id}`}
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="templates" className="mt-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Ad Templates</CardTitle>
                      <CardDescription>
                        Create custom posting templates with dynamic variables like {"{price}"}, {"{year}"}, {"{make}"}, {"{model}"}
                      </CardDescription>
                    </div>
                    <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
                      <DialogTrigger asChild>
                        <Button data-testid="button-add-template">
                          <Plus className="w-4 h-4 mr-2" />
                          Create Template
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>Create Ad Template</DialogTitle>
                          <DialogDescription>
                            Use variables: {"{price}"}, {"{year}"}, {"{make}"}, {"{model}"}, {"{trim}"}, {"{odometer}"}
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div>
                            <Label htmlFor="templateName">Template Name</Label>
                            <Input
                              id="templateName"
                              placeholder="Standard Listing"
                              value={templateForm.templateName}
                              onChange={(e) => setTemplateForm({ ...templateForm, templateName: e.target.value })}
                              data-testid="input-template-name"
                            />
                          </div>
                          <div>
                            <Label htmlFor="titleTemplate">Title Template</Label>
                            <Input
                              id="titleTemplate"
                              placeholder="{year} {make} {model} - ${price}"
                              value={templateForm.titleTemplate}
                              onChange={(e) => setTemplateForm({ ...templateForm, titleTemplate: e.target.value })}
                              data-testid="input-title-template"
                            />
                          </div>
                          <div>
                            <Label htmlFor="descriptionTemplate">Description Template</Label>
                            <Textarea
                              id="descriptionTemplate"
                              placeholder="Amazing {year} {make} {model} {trim} with only {odometer}km! Price: ${price}"
                              value={templateForm.descriptionTemplate}
                              onChange={(e) => setTemplateForm({ ...templateForm, descriptionTemplate: e.target.value })}
                              rows={6}
                              data-testid="input-description-template"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={templateForm.isDefault}
                              onCheckedChange={(checked) => setTemplateForm({ ...templateForm, isDefault: checked })}
                              data-testid="switch-default-template"
                            />
                            <Label>Set as default template</Label>
                          </div>
                        </div>
                        <DialogFooter>
                          <Button
                            onClick={() => createTemplateMutation.mutate(templateForm)}
                            disabled={!templateForm.templateName || !templateForm.titleTemplate || !templateForm.descriptionTemplate || createTemplateMutation.isPending}
                            data-testid="button-save-template"
                          >
                            Create Template
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>
                <CardContent>
                  {templatesLoading ? (
                    <div className="text-center py-8">
                      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                    </div>
                  ) : templates.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                      No templates created yet. Create your first template to standardize your posts.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {templates.map((template) => (
                        <div
                          key={template.id}
                          className="p-4 border rounded-lg bg-white"
                          data-testid={`template-item-${template.id}`}
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-medium">{template.templateName}</h3>
                                {template.isDefault && (
                                  <Badge variant="secondary">Default</Badge>
                                )}
                              </div>
                              <div className="text-sm text-slate-500">
                                Created {new Date(template.createdAt).toLocaleDateString()}
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteTemplateMutation.mutate(template.id)}
                              data-testid={`button-delete-template-${template.id}`}
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                          </div>
                          <div className="space-y-2">
                            <div>
                              <div className="text-xs font-medium text-slate-500 mb-1">Title:</div>
                              <div className="text-sm bg-slate-50 p-2 rounded font-mono">{template.titleTemplate}</div>
                            </div>
                            <div>
                              <div className="text-xs font-medium text-slate-500 mb-1">Description:</div>
                              <div className="text-sm bg-slate-50 p-2 rounded font-mono whitespace-pre-wrap">{template.descriptionTemplate}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="queue" className="mt-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Posting Queue</CardTitle>
                      <CardDescription>
                        Drag to reorder • Max 45 vehicles
                      </CardDescription>
                    </div>
                    <Dialog open={addToQueueDialogOpen} onOpenChange={setAddToQueueDialogOpen}>
                      <DialogTrigger asChild>
                        <Button data-testid="button-add-to-queue" disabled={queueItems.length >= 45}>
                          <Plus className="w-4 h-4 mr-2" />
                          Add Vehicle
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Add Vehicle to Posting Queue</DialogTitle>
                          <DialogDescription>
                            Select a vehicle, Facebook account, and template
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div>
                            <Label htmlFor="queue-vehicle">Vehicle</Label>
                            <Select onValueChange={(value) => setQueueForm({ ...queueForm, vehicleId: parseInt(value) })}>
                              <SelectTrigger id="queue-vehicle" data-testid="select-queue-vehicle">
                                <SelectValue placeholder="Select vehicle" />
                              </SelectTrigger>
                              <SelectContent>
                                {vehicles.filter(v => !queueItems.some(qi => qi.vehicleId === v.id)).map((vehicle) => (
                                  <SelectItem key={vehicle.id} value={vehicle.id.toString()}>
                                    {vehicle.year} {vehicle.make} {vehicle.model} - ${vehicle.price?.toLocaleString()}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label htmlFor="queue-account">Facebook Account (Optional)</Label>
                            <Select onValueChange={(value) => setQueueForm({ ...queueForm, facebookAccountId: parseInt(value) })}>
                              <SelectTrigger id="queue-account" data-testid="select-queue-account">
                                <SelectValue placeholder="Use default account" />
                              </SelectTrigger>
                              <SelectContent>
                                {accounts.map((account) => (
                                  <SelectItem key={account.id} value={account.id.toString()}>
                                    {account.accountName}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label htmlFor="queue-template">Ad Template (Optional)</Label>
                            <Select onValueChange={(value) => setQueueForm({ ...queueForm, templateId: parseInt(value) })}>
                              <SelectTrigger id="queue-template" data-testid="select-queue-template">
                                <SelectValue placeholder="Use default template" />
                              </SelectTrigger>
                              <SelectContent>
                                {templates.map((template) => (
                                  <SelectItem key={template.id} value={template.id.toString()}>
                                    {template.templateName} {template.isDefault && "(Default)"}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <DialogFooter>
                          <Button
                            onClick={() => addToQueueMutation.mutate(queueForm)}
                            disabled={!queueForm.vehicleId || addToQueueMutation.isPending}
                            data-testid="button-save-queue-item"
                          >
                            Add to Queue
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>
                <CardContent>
                  {queueLoading ? (
                    <div className="text-center py-8">
                      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                    </div>
                  ) : queueItems.length === 0 ? (
                    <div className="text-center py-12 text-slate-500">
                      <ListOrdered className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                      <p className="text-lg font-medium mb-2">No vehicles in queue</p>
                      <p className="mb-4">Add vehicles to start building your automated posting schedule</p>
                      <p className="text-xs">Vehicles will post in order based on your configured schedule</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="text-xs text-slate-500 mb-3 flex items-center justify-between">
                        <span>Drag items to reorder posting sequence</span>
                        <span>{queueItems.length}/45 vehicles</span>
                      </div>
                      {[...queueItems].sort((a, b) => a.queueOrder - b.queueOrder).map((item, index) => {
                        const vehicle = vehicles.find(v => v.id === item.vehicleId);
                        const account = accounts.find(a => a.id === item.facebookAccountId);
                        const template = templates.find(t => t.id === item.templateId);
                        
                        return (
                          <div
                            key={item.id}
                            draggable
                            onDragStart={() => handleDragStart(item.id)}
                            onDragOver={handleDragOver}
                            onDrop={() => handleDrop(item.id)}
                            className="p-4 border rounded-lg bg-white cursor-move hover:border-blue-300 transition-colors"
                            data-testid={`queue-item-${item.id}`}
                          >
                            <div className="flex items-start gap-3">
                              <GripVertical className="w-5 h-5 text-slate-400 mt-1 flex-shrink-0" />
                              <div className="flex-shrink-0 text-lg font-bold text-slate-400 w-8">
                                #{index + 1}
                              </div>
                              {vehicle?.imageUrl && (
                                <img
                                  src={vehicle.imageUrl}
                                  alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
                                  className="w-20 h-16 object-cover rounded flex-shrink-0"
                                />
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2 mb-2">
                                  <div>
                                    <h3 className="font-medium">
                                      {vehicle?.year} {vehicle?.make} {vehicle?.model}
                                    </h3>
                                    <p className="text-sm text-slate-500">
                                      ${vehicle?.price?.toLocaleString()} • {vehicle?.odometer?.toLocaleString()}km
                                    </p>
                                  </div>
                                  <Badge variant={item.status === 'queued' ? 'secondary' : item.status === 'posted' ? 'default' : 'destructive'}>
                                    {item.status}
                                  </Badge>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                  <div>
                                    <span className="text-slate-500">Account:</span>{" "}
                                    <span className="font-medium">{account?.accountName || "Default"}</span>
                                  </div>
                                  <div>
                                    <span className="text-slate-500">Template:</span>{" "}
                                    <span className="font-medium">{template?.templateName || "Default"}</span>
                                  </div>
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteFromQueueMutation.mutate(item.id)}
                                data-testid={`button-remove-queue-${item.id}`}
                              >
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="schedule" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Posting Schedule</CardTitle>
                  <CardDescription>
                    Configure automated posting times and intervals
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    saveScheduleMutation.mutate(scheduleForm);
                  }} className="space-y-6">
                    <div className="space-y-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <Label htmlFor="startTime">Start Time</Label>
                          <Input
                            id="startTime"
                            type="time"
                            value={scheduleForm.startTime}
                            onChange={(e) => setScheduleForm({ ...scheduleForm, startTime: e.target.value })}
                            data-testid="input-start-time"
                          />
                          <p className="text-xs text-slate-500 mt-1">What time to start posting each day</p>
                        </div>
                        <div>
                          <Label htmlFor="interval">Interval (minutes)</Label>
                          <Input
                            id="interval"
                            type="number"
                            min="1"
                            value={scheduleForm.intervalMinutes}
                            onChange={(e) => setScheduleForm({ ...scheduleForm, intervalMinutes: parseInt(e.target.value) || 60 })}
                            data-testid="input-interval"
                          />
                          <p className="text-xs text-slate-500 mt-1">Time between posts</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg">
                        <Switch
                          checked={scheduleForm.isActive}
                          onCheckedChange={(checked) => setScheduleForm({ ...scheduleForm, isActive: checked })}
                          data-testid="switch-schedule-active"
                        />
                        <div className="flex-1">
                          <Label className="text-base">Enable Automated Posting</Label>
                          <p className="text-sm text-slate-500">
                            Posts will automatically go live based on your queue and schedule
                          </p>
                        </div>
                      </div>

                      <div className="p-4 border rounded-lg bg-blue-50 border-blue-200">
                        <div className="flex items-start gap-3">
                          <Clock className="w-5 h-5 text-blue-600 mt-0.5" />
                          <div>
                            <h4 className="font-medium text-blue-900 mb-1">Schedule Preview</h4>
                            <p className="text-sm text-blue-700">
                              {scheduleForm.isActive ? (
                                <>
                                  Posting starts at <strong>{scheduleForm.startTime}</strong> with{' '}
                                  <strong>{scheduleForm.intervalMinutes} minute</strong> intervals
                                </>
                              ) : (
                                "Automated posting is currently disabled"
                              )}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <Button 
                      type="submit" 
                      disabled={saveScheduleMutation.isPending}
                      data-testid="button-save-schedule"
                    >
                      Save Schedule
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
