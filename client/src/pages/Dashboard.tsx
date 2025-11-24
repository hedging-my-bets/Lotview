import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Navbar } from "@/components/Navbar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MessageSquare, Settings, Sparkles, Users, LogOut } from "lucide-react";
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
            <TabsList className="grid w-full grid-cols-4 mb-8">
              <TabsTrigger value="users" className="flex items-center gap-2" data-testid="tab-users">
                <Users className="w-4 h-4" />
                <span className="hidden sm:inline">Users</span>
              </TabsTrigger>
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

            <TabsContent value="conversations">
              <Card>
                <CardContent className="py-12 text-center">
                  <MessageSquare className="w-12 h-12 mx-auto mb-4 text-slate-400" />
                  <p className="text-slate-500">Conversation analytics coming soon</p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="prompts">
              <Card>
                <CardContent className="py-12 text-center">
                  <Settings className="w-12 h-12 mx-auto mb-4 text-slate-400" />
                  <p className="text-slate-500">Prompt management coming soon</p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="insights">
              <Card>
                <CardContent className="py-12 text-center">
                  <Sparkles className="w-12 h-12 mx-auto mb-4 text-slate-400" />
                  <p className="text-slate-500">AI insights coming soon</p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
