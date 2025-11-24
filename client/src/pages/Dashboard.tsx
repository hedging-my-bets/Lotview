import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Navbar } from "@/components/Navbar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MessageSquare, Settings, Sparkles, Users, LogOut, DollarSign, Plus, Edit2, Trash2, Target, Webhook } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface User {
  id: number;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

interface CreditScoreTier {
  id: number;
  tierName: string;
  minScore: number;
  maxScore: number;
  interestRate: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ModelYearTerm {
  id: number;
  minModelYear: number;
  maxModelYear: number;
  availableTerms: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const { toast } = useToast();

  // New user form state
  const [newUser, setNewUser] = useState({
    email: "",
    password: "",
    name: "",
    role: "salesperson",
  });

  // Financing rules state
  const [creditTiers, setCreditTiers] = useState<CreditScoreTier[]>([]);
  const [modelYearTerms, setModelYearTerms] = useState<ModelYearTerm[]>([]);
  const [isCreditTierDialogOpen, setIsCreditTierDialogOpen] = useState(false);
  const [isModelYearDialogOpen, setIsModelYearDialogOpen] = useState(false);
  const [editingCreditTier, setEditingCreditTier] = useState<CreditScoreTier | null>(null);
  const [editingModelYearTerm, setEditingModelYearTerm] = useState<ModelYearTerm | null>(null);
  
  const [newCreditTier, setNewCreditTier] = useState({
    tierName: "",
    minScore: 300,
    maxScore: 850,
    interestRate: 5.99,
  });

  const [newModelYearTerm, setNewModelYearTerm] = useState({
    minModelYear: 2020,
    maxModelYear: 2025,
    availableTerms: ["36", "48", "60"],
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
      
      // Only masters can access this dashboard
      if (parsedUser.role !== 'master') {
        toast({
          title: "Access Denied",
          description: "You don't have permission to access this page",
          variant: "destructive",
        });
        setLocation('/');
        return;
      }

      setUser(parsedUser);
      await loadUsers(token);
      await loadFinancingRules(token);
    } catch (error) {
      console.error("Auth check failed:", error);
      setLocation('/login');
    } finally {
      setIsLoading(false);
    }
  };

  const loadUsers = async (token: string) => {
    try {
      const response = await fetch('/api/users', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      }
    } catch (error) {
      console.error("Failed to load users:", error);
    }
  };

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

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem('auth_token');

    if (!token) return;

    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(newUser),
      });

      if (response.ok) {
        toast({
          title: "User Created",
          description: `${newUser.name} has been added successfully`,
        });
        
        setIsCreateDialogOpen(false);
        setNewUser({ email: "", password: "", name: "", role: "salesperson" });
        await loadUsers(token);
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.error || "Failed to create user",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create user",
        variant: "destructive",
      });
    }
  };

  const toggleUserStatus = async (userId: number, currentStatus: boolean) => {
    const token = localStorage.getItem('auth_token');
    if (!token) return;

    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ isActive: !currentStatus }),
      });

      if (response.ok) {
        toast({
          title: "User Updated",
          description: `User ${!currentStatus ? 'activated' : 'deactivated'} successfully`,
        });
        await loadUsers(token);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update user",
        variant: "destructive",
      });
    }
  };

  const loadFinancingRules = async (token: string) => {
    try {
      const [tiersResponse, termsResponse] = await Promise.all([
        fetch('/api/financing/credit-tiers', {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
        fetch('/api/financing/model-year-terms', {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
      ]);

      if (tiersResponse.ok) {
        const tiers = await tiersResponse.json();
        setCreditTiers(tiers);
      }

      if (termsResponse.ok) {
        const terms = await termsResponse.json();
        setModelYearTerms(terms);
      }
    } catch (error) {
      console.error("Failed to load financing rules:", error);
    }
  };

  const handleCreateCreditTier = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem('auth_token');
    if (!token) return;

    if (newCreditTier.minScore > newCreditTier.maxScore) {
      toast({
        title: "Validation Error",
        description: "Min score must be less than or equal to max score",
        variant: "destructive",
      });
      return;
    }

    try {
      const url = editingCreditTier 
        ? `/api/financing/credit-tiers/${editingCreditTier.id}`
        : '/api/financing/credit-tiers';
      
      const method = editingCreditTier ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(newCreditTier),
      });

      if (response.ok) {
        toast({
          title: editingCreditTier ? "Credit Tier Updated" : "Credit Tier Created",
          description: `${newCreditTier.tierName} has been ${editingCreditTier ? 'updated' : 'added'} successfully`,
        });
        
        setIsCreditTierDialogOpen(false);
        setEditingCreditTier(null);
        setNewCreditTier({ tierName: "", minScore: 300, maxScore: 850, interestRate: 5.99 });
        await loadFinancingRules(token);
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.error || `Failed to ${editingCreditTier ? 'update' : 'create'} credit tier`,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to ${editingCreditTier ? 'update' : 'create'} credit tier`,
        variant: "destructive",
      });
    }
  };

  const openEditCreditTier = (tier: CreditScoreTier) => {
    setEditingCreditTier(tier);
    setNewCreditTier({
      tierName: tier.tierName,
      minScore: tier.minScore,
      maxScore: tier.maxScore,
      interestRate: tier.interestRate,
    });
    setIsCreditTierDialogOpen(true);
  };

  const deleteCreditTier = async (id: number) => {
    const token = localStorage.getItem('auth_token');
    if (!token) return;

    try {
      const response = await fetch(`/api/financing/credit-tiers/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        toast({
          title: "Credit Tier Deleted",
          description: "The tier has been removed successfully",
        });
        await loadFinancingRules(token);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete credit tier",
        variant: "destructive",
      });
    }
  };

  const handleCreateModelYearTerm = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem('auth_token');
    if (!token) return;

    if (newModelYearTerm.minModelYear > newModelYearTerm.maxModelYear) {
      toast({
        title: "Validation Error",
        description: "Min year must be less than or equal to max year",
        variant: "destructive",
      });
      return;
    }

    if (newModelYearTerm.availableTerms.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please select at least one term",
        variant: "destructive",
      });
      return;
    }

    try {
      const url = editingModelYearTerm
        ? `/api/financing/model-year-terms/${editingModelYearTerm.id}`
        : '/api/financing/model-year-terms';
      
      const method = editingModelYearTerm ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(newModelYearTerm),
      });

      if (response.ok) {
        toast({
          title: editingModelYearTerm ? "Model Year Term Updated" : "Model Year Term Created",
          description: `The term rule has been ${editingModelYearTerm ? 'updated' : 'added'} successfully`,
        });
        
        setIsModelYearDialogOpen(false);
        setEditingModelYearTerm(null);
        setNewModelYearTerm({ minModelYear: 2020, maxModelYear: 2025, availableTerms: ["36", "48", "60"] });
        await loadFinancingRules(token);
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.error || `Failed to ${editingModelYearTerm ? 'update' : 'create'} model year term`,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to ${editingModelYearTerm ? 'update' : 'create'} model year term`,
        variant: "destructive",
      });
    }
  };

  const openEditModelYearTerm = (term: ModelYearTerm) => {
    setEditingModelYearTerm(term);
    setNewModelYearTerm({
      minModelYear: term.minModelYear,
      maxModelYear: term.maxModelYear,
      availableTerms: term.availableTerms,
    });
    setIsModelYearDialogOpen(true);
  };

  const deleteModelYearTerm = async (id: number) => {
    const token = localStorage.getItem('auth_token');
    if (!token) return;

    try {
      const response = await fetch(`/api/financing/model-year-terms/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        toast({
          title: "Model Year Term Deleted",
          description: "The term rule has been removed successfully",
        });
        await loadFinancingRules(token);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete model year term",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-500">Loading dashboard...</p>
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
              <h1 className="text-3xl font-bold text-slate-900 mb-2">Master Dashboard</h1>
              <p className="text-slate-600">Welcome back, {user?.name}</p>
            </div>
            <Button onClick={handleLogout} variant="outline" data-testid="button-logout">
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>

          <Tabs defaultValue="users" className="w-full">
            <TabsList className="grid w-full grid-cols-6 mb-8">
              <TabsTrigger value="users" className="flex items-center gap-2" data-testid="tab-users">
                <Users className="w-4 h-4" />
                <span className="hidden sm:inline">Users</span>
              </TabsTrigger>
              <TabsTrigger value="financing" className="flex items-center gap-2" data-testid="tab-financing">
                <DollarSign className="w-4 h-4" />
                <span className="hidden sm:inline">Financing</span>
              </TabsTrigger>
              <TabsTrigger value="remarketing" className="flex items-center gap-2" data-testid="tab-remarketing">
                <Target className="w-4 h-4" />
                <span className="hidden sm:inline">Remarketing</span>
              </TabsTrigger>
              <TabsTrigger value="webhooks" className="flex items-center gap-2" data-testid="tab-webhooks">
                <Webhook className="w-4 h-4" />
                <span className="hidden sm:inline">Webhooks</span>
              </TabsTrigger>
              <TabsTrigger value="conversations" className="flex items-center gap-2" data-testid="tab-conversations">
                <MessageSquare className="w-4 h-4" />
                <span className="hidden sm:inline">Chat</span>
              </TabsTrigger>
              <TabsTrigger value="insights" className="flex items-center gap-2" data-testid="tab-insights">
                <Sparkles className="w-4 h-4" />
                <span className="hidden sm:inline">Insights</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="users">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>User Management</CardTitle>
                      <CardDescription>
                        Create and manage sales managers and salespeople
                      </CardDescription>
                    </div>
                    <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                      <DialogTrigger asChild>
                        <Button data-testid="button-create-user">
                          <Users className="w-4 h-4 mr-2" />
                          Create User
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Create New User</DialogTitle>
                          <DialogDescription>
                            Add a new sales manager or salesperson to the system
                          </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleCreateUser} className="space-y-4">
                          <div>
                            <Label htmlFor="name">Full Name</Label>
                            <Input
                              id="name"
                              value={newUser.name}
                              onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                              placeholder="John Doe"
                              required
                              data-testid="input-user-name"
                            />
                          </div>
                          <div>
                            <Label htmlFor="email">Email</Label>
                            <Input
                              id="email"
                              type="email"
                              value={newUser.email}
                              onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                              placeholder="john@olympicauto.com"
                              required
                              data-testid="input-user-email"
                            />
                          </div>
                          <div>
                            <Label htmlFor="password">Password</Label>
                            <Input
                              id="password"
                              type="password"
                              value={newUser.password}
                              onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                              placeholder="••••••••"
                              required
                              data-testid="input-user-password"
                            />
                          </div>
                          <div>
                            <Label htmlFor="role">Role</Label>
                            <Select
                              value={newUser.role}
                              onValueChange={(value) => setNewUser({ ...newUser, role: value })}
                            >
                              <SelectTrigger data-testid="select-user-role">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="salesperson">Salesperson</SelectItem>
                                <SelectItem value="manager">Sales Manager</SelectItem>
                                <SelectItem value="master">Master Admin</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <Button type="submit" className="w-full" data-testid="button-submit-user">
                            Create User
                          </Button>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {users.length === 0 ? (
                      <div className="text-center py-12 text-slate-500">
                        No users found. Create your first user to get started.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {users.map((u) => (
                          <div
                            key={u.id}
                            className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50"
                            data-testid={`user-row-${u.id}`}
                          >
                            <div className="flex-1">
                              <div className="font-semibold text-slate-900">{u.name}</div>
                              <div className="text-sm text-slate-600">{u.email}</div>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded">
                                  {u.role.charAt(0).toUpperCase() + u.role.slice(1)}
                                </span>
                                <span className={`text-xs px-2 py-1 rounded ${u.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                  {u.isActive ? 'Active' : 'Inactive'}
                                </span>
                              </div>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => toggleUserStatus(u.id, u.isActive)}
                              data-testid={`button-toggle-user-${u.id}`}
                            >
                              {u.isActive ? 'Deactivate' : 'Activate'}
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="financing">
              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Credit Score Tiers</CardTitle>
                        <CardDescription>
                          Configure interest rates by credit score range
                        </CardDescription>
                      </div>
                      <Dialog open={isCreditTierDialogOpen} onOpenChange={(open) => {
                        setIsCreditTierDialogOpen(open);
                        if (!open) {
                          setEditingCreditTier(null);
                          setNewCreditTier({ tierName: "", minScore: 300, maxScore: 850, interestRate: 5.99 });
                        }
                      }}>
                        <DialogTrigger asChild>
                          <Button size="sm" data-testid="button-create-credit-tier">
                            <Plus className="w-4 h-4 mr-2" />
                            Add Tier
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>{editingCreditTier ? 'Edit' : 'Create'} Credit Score Tier</DialogTitle>
                            <DialogDescription>
                              Define a credit score range and its interest rate
                            </DialogDescription>
                          </DialogHeader>
                          <form onSubmit={handleCreateCreditTier} className="space-y-4">
                            <div>
                              <Label htmlFor="tierName">Tier Name</Label>
                              <Input
                                id="tierName"
                                value={newCreditTier.tierName}
                                onChange={(e) => setNewCreditTier({ ...newCreditTier, tierName: e.target.value })}
                                placeholder="Excellent"
                                required
                                data-testid="input-tier-name"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label htmlFor="minScore">Min Score</Label>
                                <Input
                                  id="minScore"
                                  type="number"
                                  min={300}
                                  max={850}
                                  value={newCreditTier.minScore}
                                  onChange={(e) => setNewCreditTier({ ...newCreditTier, minScore: parseInt(e.target.value) })}
                                  required
                                  data-testid="input-min-score"
                                />
                              </div>
                              <div>
                                <Label htmlFor="maxScore">Max Score</Label>
                                <Input
                                  id="maxScore"
                                  type="number"
                                  min={300}
                                  max={850}
                                  value={newCreditTier.maxScore}
                                  onChange={(e) => setNewCreditTier({ ...newCreditTier, maxScore: parseInt(e.target.value) })}
                                  required
                                  data-testid="input-max-score"
                                />
                              </div>
                            </div>
                            <div>
                              <Label htmlFor="interestRate">Interest Rate (%)</Label>
                              <Input
                                id="interestRate"
                                type="number"
                                step="0.01"
                                min={0}
                                max={100}
                                value={newCreditTier.interestRate}
                                onChange={(e) => setNewCreditTier({ ...newCreditTier, interestRate: parseFloat(e.target.value) })}
                                required
                                data-testid="input-interest-rate"
                              />
                            </div>
                            <Button type="submit" className="w-full" data-testid="button-submit-credit-tier">
                              {editingCreditTier ? 'Update' : 'Create'} Tier
                            </Button>
                          </form>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {creditTiers.length === 0 ? (
                        <div className="text-center py-8 text-slate-500">
                          No credit tiers configured. Add your first tier to get started.
                        </div>
                      ) : (
                        creditTiers.map((tier) => (
                          <div
                            key={tier.id}
                            className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50"
                            data-testid={`credit-tier-${tier.id}`}
                          >
                            <div className="flex-1">
                              <div className="font-semibold text-slate-900">{tier.tierName}</div>
                              <div className="text-sm text-slate-600">
                                {tier.minScore} - {tier.maxScore}
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="text-right">
                                <div className="font-semibold text-primary">{tier.interestRate}%</div>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditCreditTier(tier)}
                                data-testid={`button-edit-tier-${tier.id}`}
                              >
                                <Edit2 className="w-4 h-4 text-blue-500" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => deleteCreditTier(tier.id)}
                                data-testid={`button-delete-tier-${tier.id}`}
                              >
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </Button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Model Year Terms</CardTitle>
                        <CardDescription>
                          Configure available loan terms by vehicle age
                        </CardDescription>
                      </div>
                      <Dialog open={isModelYearDialogOpen} onOpenChange={(open) => {
                        setIsModelYearDialogOpen(open);
                        if (!open) {
                          setEditingModelYearTerm(null);
                          setNewModelYearTerm({ minModelYear: 2020, maxModelYear: 2025, availableTerms: ["36", "48", "60"] });
                        }
                      }}>
                        <DialogTrigger asChild>
                          <Button size="sm" data-testid="button-create-model-year-term">
                            <Plus className="w-4 h-4 mr-2" />
                            Add Rule
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>{editingModelYearTerm ? 'Edit' : 'Create'} Model Year Term Rule</DialogTitle>
                            <DialogDescription>
                              Define available loan terms for a model year range
                            </DialogDescription>
                          </DialogHeader>
                          <form onSubmit={handleCreateModelYearTerm} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label htmlFor="minModelYear">Min Year</Label>
                                <Input
                                  id="minModelYear"
                                  type="number"
                                  min={1980}
                                  max={2050}
                                  value={newModelYearTerm.minModelYear}
                                  onChange={(e) => setNewModelYearTerm({ ...newModelYearTerm, minModelYear: parseInt(e.target.value) })}
                                  required
                                  data-testid="input-min-year"
                                />
                              </div>
                              <div>
                                <Label htmlFor="maxModelYear">Max Year</Label>
                                <Input
                                  id="maxModelYear"
                                  type="number"
                                  min={1980}
                                  max={2050}
                                  value={newModelYearTerm.maxModelYear}
                                  onChange={(e) => setNewModelYearTerm({ ...newModelYearTerm, maxModelYear: parseInt(e.target.value) })}
                                  required
                                  data-testid="input-max-year"
                                />
                              </div>
                            </div>
                            <div>
                              <Label>Available Terms (months)</Label>
                              <div className="grid grid-cols-3 gap-2 mt-2">
                                {["36", "48", "60", "72", "84"].map((term) => (
                                  <label key={term} className="flex items-center gap-2 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={newModelYearTerm.availableTerms.includes(term)}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          setNewModelYearTerm({
                                            ...newModelYearTerm,
                                            availableTerms: [...newModelYearTerm.availableTerms, term].sort(),
                                          });
                                        } else {
                                          setNewModelYearTerm({
                                            ...newModelYearTerm,
                                            availableTerms: newModelYearTerm.availableTerms.filter(t => t !== term),
                                          });
                                        }
                                      }}
                                      className="rounded"
                                    />
                                    <span className="text-sm">{term}</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                            <Button type="submit" className="w-full" data-testid="button-submit-model-year-term">
                              {editingModelYearTerm ? 'Update' : 'Create'} Rule
                            </Button>
                          </form>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {modelYearTerms.length === 0 ? (
                        <div className="text-center py-8 text-slate-500">
                          No term rules configured. Add your first rule to get started.
                        </div>
                      ) : (
                        modelYearTerms.map((term) => (
                          <div
                            key={term.id}
                            className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50"
                            data-testid={`model-year-term-${term.id}`}
                          >
                            <div className="flex-1">
                              <div className="font-semibold text-slate-900">
                                {term.minModelYear} - {term.maxModelYear}
                              </div>
                              <div className="text-sm text-slate-600">
                                Terms: {term.availableTerms.join(", ")} months
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditModelYearTerm(term)}
                                data-testid={`button-edit-term-${term.id}`}
                              >
                                <Edit2 className="w-4 h-4 text-blue-500" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => deleteModelYearTerm(term.id)}
                                data-testid={`button-delete-term-${term.id}`}
                              >
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </Button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="remarketing">
              <Card>
                <CardHeader>
                  <CardTitle>Remarketing Configuration</CardTitle>
                  <CardDescription>
                    Select up to 20 vehicles for remarketing campaigns and set budget priorities
                  </CardDescription>
                </CardHeader>
                <CardContent className="py-12 text-center">
                  <Target className="w-12 h-12 mx-auto mb-4 text-slate-400" />
                  <p className="text-slate-500 mb-4">Remarketing vehicle selector coming soon</p>
                  <p className="text-sm text-slate-400">
                    Choose vehicles based on view history and engagement metrics
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="webhooks">
              <Card>
                <CardHeader>
                  <CardTitle>Webhook Configuration</CardTitle>
                  <CardDescription>
                    Configure PBS and other webhook integrations for lead capture
                  </CardDescription>
                </CardHeader>
                <CardContent className="py-12 text-center">
                  <Webhook className="w-12 h-12 mx-auto mb-4 text-slate-400" />
                  <p className="text-slate-500 mb-4">Webhook management coming soon</p>
                  <p className="text-sm text-slate-400">
                    Connect PBS and external platforms for automated lead routing
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="conversations">
              <Card>
                <CardHeader>
                  <CardTitle>Live Conversations</CardTitle>
                  <CardDescription>
                    Monitor chatbot conversations in real-time and view conversation history
                  </CardDescription>
                </CardHeader>
                <CardContent className="py-12 text-center">
                  <MessageSquare className="w-12 h-12 mx-auto mb-4 text-slate-400" />
                  <p className="text-slate-500 mb-4">Chatbot conversation monitoring coming soon</p>
                  <p className="text-sm text-slate-400">
                    Track customer interactions with SMS handoff to GoHighLevel
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="insights">
              <Card>
                <CardHeader>
                  <CardTitle>AI Analytics & Insights</CardTitle>
                  <CardDescription>
                    View sentiment analysis, intent detection, and conversion insights
                  </CardDescription>
                </CardHeader>
                <CardContent className="py-12 text-center">
                  <Sparkles className="w-12 h-12 mx-auto mb-4 text-slate-400" />
                  <p className="text-slate-500 mb-4">AI-powered analytics coming soon</p>
                  <p className="text-sm text-slate-400">
                    Analyze conversation sentiment, customer intent, and conversion patterns
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
