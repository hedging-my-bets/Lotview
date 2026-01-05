import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { apiGet, apiPost, apiPatch } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Building, Copy, Facebook, Link2, Plus, RefreshCw, Save, Users, Webhook } from "lucide-react";

type BusinessAccount = {
  id: number;
  businessId: string;
  businessName?: string | null;
  tokenExpiresAt?: string | null;
};

type ConnectedPage = {
  id: number;
  pageId: string;
  pageName: string;
  pageDmLink?: string | null;
  rooftopId?: number | null;
  hasValidToken?: boolean;
  webhookSubscribed?: boolean | null;
};

type Rooftop = {
  id: number;
  name: string;
};

type SalesPerson = {
  id: number;
  name: string;
  role: string;
};

type RooftopMembership = {
  userId: number;
  canPost: boolean;
};

const allowedManagerRoles = new Set(["manager", "admin", "master", "super_admin"]);

function getMembershipRole(userRole: string): "rep" | "manager" | "admin" {
  if (["admin", "master", "super_admin"].includes(userRole)) return "admin";
  if (userRole === "manager") return "manager";
  return "rep";
}

export default function MetaConnect() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMetaSettings, setIsLoadingMetaSettings] = useState(false);
  const [isConnectingBusiness, setIsConnectingBusiness] = useState(false);
  const [isSavingDealershipDmLink, setIsSavingDealershipDmLink] = useState(false);
  const [isCreatingRooftop, setIsCreatingRooftop] = useState(false);
  const [isSubscribingPages, setIsSubscribingPages] = useState(false);
  const [subscribingPageId, setSubscribingPageId] = useState<string | null>(null);

  const [businessAccounts, setBusinessAccounts] = useState<BusinessAccount[]>([]);
  const [connectedPages, setConnectedPages] = useState<ConnectedPage[]>([]);
  const [rooftops, setRooftops] = useState<Rooftop[]>([]);
  const [salespeople, setSalespeople] = useState<SalesPerson[]>([]);
  const [dealershipDmLink, setDealershipDmLink] = useState("");
  const [systemUserForms, setSystemUserForms] = useState<Record<string, { systemUserId: string; systemUserToken: string }>>({});
  const [pageMetaEdits, setPageMetaEdits] = useState<Record<string, { pageDmLink: string; rooftopId: string }>>({});
  const [newRooftopName, setNewRooftopName] = useState("");
  const [rooftopMemberships, setRooftopMemberships] = useState<Record<number, Record<number, boolean>>>({});
  const [membershipSavingKey, setMembershipSavingKey] = useState<string | null>(null);

  const webhookUrl = typeof window !== "undefined" ? `${window.location.origin}/webhooks/meta` : "";

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (user) {
      loadMetaSettings();
    }
  }, [user]);

  const checkAuth = () => {
    const token = localStorage.getItem("auth_token");
    const storedUser = localStorage.getItem("user");

    if (!token || !storedUser) {
      setLocation("/login");
      return;
    }

    try {
      const parsedUser = JSON.parse(storedUser);
      if (!allowedManagerRoles.has(parsedUser.role)) {
        toast({
          title: "Access Denied",
          description: "You do not have permission to access this page",
          variant: "destructive",
        });
        setLocation("/");
        return;
      }
      setUser(parsedUser);
    } catch (error) {
      console.error("Auth check failed:", error);
      setLocation("/login");
    } finally {
      setIsLoading(false);
    }
  };

  const loadRooftopMemberships = async (rooftopList: Rooftop[]) => {
    if (rooftopList.length === 0) {
      setRooftopMemberships({});
      return;
    }

    const token = localStorage.getItem("auth_token");
    const membershipLists = await Promise.all(
      rooftopList.map((rooftop) =>
        apiGet<RooftopMembership[]>(`/api/rooftops/${rooftop.id}/memberships`, {
          Authorization: `Bearer ${token}`,
        }).catch(() => [])
      )
    );

    const membershipMap: Record<number, Record<number, boolean>> = {};
    rooftopList.forEach((rooftop, index) => {
      const memberships = membershipLists[index] || [];
      const userMap: Record<number, boolean> = {};
      memberships.forEach((membership) => {
        userMap[membership.userId] = !!membership.canPost;
      });
      membershipMap[rooftop.id] = userMap;
    });

    setRooftopMemberships(membershipMap);
  };

  const loadMetaSettings = async () => {
    setIsLoadingMetaSettings(true);
    try {
      const token = localStorage.getItem("auth_token");
      const [accounts, pages, rooftopList, dealershipSettings, salespeopleList] = await Promise.all([
        apiGet<BusinessAccount[]>("/api/facebook/business/accounts", { Authorization: `Bearer ${token}` }).catch(() => []),
        apiGet<ConnectedPage[]>("/api/facebook/connected-pages?includeWebhookStatus=true", { Authorization: `Bearer ${token}` }).catch(() => []),
        apiGet<Rooftop[]>("/api/rooftops", { Authorization: `Bearer ${token}` }).catch(() => []),
        apiGet<{ pageDmLink?: string | null }>("/api/manager/dealership-settings", { Authorization: `Bearer ${token}` }).catch(() => null),
        apiGet<SalesPerson[]>("/api/salespeople", { Authorization: `Bearer ${token}` }).catch(() => []),
      ]);

      setBusinessAccounts(accounts || []);
      setConnectedPages(pages || []);
      setRooftops(rooftopList || []);
      setSalespeople(salespeopleList || []);
      setDealershipDmLink(dealershipSettings?.pageDmLink || "");

      const nextPageEdits: Record<string, { pageDmLink: string; rooftopId: string }> = {};
      (pages || []).forEach((page) => {
        nextPageEdits[page.pageId] = {
          pageDmLink: page.pageDmLink || "",
          rooftopId: page.rooftopId ? String(page.rooftopId) : "",
        };
      });
      setPageMetaEdits(nextPageEdits);

      await loadRooftopMemberships(rooftopList || []);
    } catch (error) {
      console.error("Error loading Meta settings:", error);
      toast({
        title: "Error",
        description: "Failed to load Meta settings",
        variant: "destructive",
      });
    } finally {
      setIsLoadingMetaSettings(false);
    }
  };

  const handleConnectBusiness = async () => {
    setIsConnectingBusiness(true);
    try {
      const token = localStorage.getItem("auth_token");
      const result = await apiPost<{ authUrl: string }>("/api/facebook/business/oauth/start", {}, {
        Authorization: `Bearer ${token}`,
      });
      const popup = window.open(result.authUrl, "Facebook Business Auth", "width=600,height=700");
      if (!popup) {
        toast({
          title: "Popup blocked",
          description: "Please allow popups to connect your Business account",
          variant: "destructive",
        });
        return;
      }

      const poll = setInterval(() => {
        if (popup.closed) {
          clearInterval(poll);
          loadMetaSettings();
        }
      }, 500);
    } catch (error: any) {
      toast({
        title: "Connection failed",
        description: error.body?.error || error.message || "Unable to start Business OAuth",
        variant: "destructive",
      });
    } finally {
      setIsConnectingBusiness(false);
    }
  };

  const handleSaveDealershipDmLink = async () => {
    setIsSavingDealershipDmLink(true);
    try {
      const token = localStorage.getItem("auth_token");
      const result = await apiPost<{ pageDmLink?: string | null }>(
        "/api/manager/dealership-settings",
        { pageDmLink: dealershipDmLink },
        { Authorization: `Bearer ${token}` }
      );
      setDealershipDmLink(result.pageDmLink || "");
      toast({ title: "Saved", description: "Default Page DM link updated" });
    } catch (error: any) {
      toast({
        title: "Save failed",
        description: error.body?.error || error.message || "Unable to save",
        variant: "destructive",
      });
    } finally {
      setIsSavingDealershipDmLink(false);
    }
  };

  const handleSavePageMeta = async (pageId: string) => {
    try {
      const token = localStorage.getItem("auth_token");
      const edits = pageMetaEdits[pageId];
      await apiPatch(
        `/api/facebook/pages/${pageId}/metadata`,
        {
          pageDmLink: edits?.pageDmLink,
          rooftopId: edits?.rooftopId || null,
        },
        { Authorization: `Bearer ${token}` }
      );
      toast({ title: "Saved", description: "Page settings updated" });
      loadMetaSettings();
    } catch (error: any) {
      toast({
        title: "Save failed",
        description: error.body?.error || error.message || "Unable to update page settings",
        variant: "destructive",
      });
    }
  };

  const handleSaveSystemUserToken = async (businessId: string) => {
    try {
      const token = localStorage.getItem("auth_token");
      const form = systemUserForms[businessId];
      if (!form?.systemUserToken?.trim()) {
        toast({
          title: "Token required",
          description: "Paste the System User token to save",
          variant: "destructive",
        });
        return;
      }
      await apiPost(
        "/api/facebook/business/system-user-token",
        {
          businessId,
          systemUserId: form.systemUserId || null,
          systemUserToken: form.systemUserToken,
        },
        { Authorization: `Bearer ${token}` }
      );
      toast({ title: "Saved", description: "System User token updated" });
      setSystemUserForms((prev) => ({ ...prev, [businessId]: { systemUserId: "", systemUserToken: "" } }));
      loadMetaSettings();
    } catch (error: any) {
      toast({
        title: "Save failed",
        description: error.body?.error || error.message || "Unable to save token",
        variant: "destructive",
      });
    }
  };

  const handleSubscribePages = async (pageIds?: string[]) => {
    if (pageIds && pageIds.length === 1) {
      setSubscribingPageId(pageIds[0]);
    } else {
      setIsSubscribingPages(true);
    }

    try {
      const token = localStorage.getItem("auth_token");
      const result = await apiPost<{ results?: Array<{ pageId: string; success: boolean; error?: string }> }>(
        "/api/facebook/pages/subscribe",
        pageIds && pageIds.length > 0 ? { pageIds } : {},
        { Authorization: `Bearer ${token}` }
      );

      const failures = result?.results?.filter((r) => !r.success) || [];
      if (failures.length > 0) {
        toast({
          title: "Some pages failed",
          description: `${failures.length} page(s) could not be subscribed.`,
          variant: "destructive",
        });
      } else {
        toast({ title: "Subscribed", description: "Webhook subscriptions updated" });
      }

      loadMetaSettings();
    } catch (error: any) {
      toast({
        title: "Subscription failed",
        description: error.body?.error || error.message || "Unable to subscribe pages",
        variant: "destructive",
      });
    } finally {
      setIsSubscribingPages(false);
      setSubscribingPageId(null);
    }
  };

  const handleCreateRooftop = async () => {
    if (!newRooftopName.trim()) return;
    setIsCreatingRooftop(true);
    try {
      const token = localStorage.getItem("auth_token");
      await apiPost(
        "/api/rooftops",
        { name: newRooftopName.trim() },
        { Authorization: `Bearer ${token}` }
      );
      setNewRooftopName("");
      toast({ title: "Rooftop added", description: "New rooftop created" });
      loadMetaSettings();
    } catch (error: any) {
      toast({
        title: "Create failed",
        description: error.body?.error || error.message || "Unable to create rooftop",
        variant: "destructive",
      });
    } finally {
      setIsCreatingRooftop(false);
    }
  };

  const handleToggleMembership = async (rooftopId: number, salesperson: SalesPerson, nextValue: boolean) => {
    const key = `${rooftopId}:${salesperson.id}`;
    setMembershipSavingKey(key);
    try {
      const token = localStorage.getItem("auth_token");
      await apiPost(
        `/api/rooftops/${rooftopId}/memberships`,
        {
          userId: salesperson.id,
          canPost: nextValue,
          role: getMembershipRole(salesperson.role),
        },
        { Authorization: `Bearer ${token}` }
      );

      setRooftopMemberships((prev) => {
        const next = { ...prev };
        const rooftopMembers = { ...(next[rooftopId] || {}) };
        rooftopMembers[salesperson.id] = nextValue;
        next[rooftopId] = rooftopMembers;
        return next;
      });
      toast({
        title: nextValue ? "Access granted" : "Access removed",
        description: `${salesperson.name} ${nextValue ? "can" : "can no longer"} handle this rooftop`,
      });
    } catch (error: any) {
      toast({
        title: "Update failed",
        description: error.body?.error || error.message || "Unable to update membership",
        variant: "destructive",
      });
    } finally {
      setMembershipSavingKey(null);
    }
  };

  const copyToClipboard = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast({ title: "Copied", description: `${label} copied to clipboard` });
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Please copy manually",
        variant: "destructive",
      });
    }
  };

  const membershipSummary = useMemo(() => {
    const totals = rooftops.reduce(
      (acc, rooftop) => {
        const members = Object.values(rooftopMemberships[rooftop.id] || {});
        const active = members.filter(Boolean).length;
        acc.total += active;
        if (active > 0) acc.rooftopsWithCoverage += 1;
        return acc;
      },
      { total: 0, rooftopsWithCoverage: 0 }
    );
    return totals;
  }, [rooftops, rooftopMemberships]);

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

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4 max-w-6xl flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Link href="/manager" className="text-sm text-muted-foreground hover:text-primary">
              Back to Manager
            </Link>
            <div className="h-4 w-px bg-gray-200" />
            <div className="flex items-center gap-2 text-[#022d60]">
              <Facebook className="w-5 h-5" />
              <span className="font-semibold">Meta Connect</span>
            </div>
          </div>
          <Button variant="outline" onClick={loadMetaSettings} disabled={isLoadingMetaSettings}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoadingMetaSettings ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-6xl space-y-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold text-[#022d60]">Meta Business & Messaging</h1>
          <p className="text-sm text-muted-foreground">
            Connect your Meta Business, wire webhooks, and route Page DMs to rooftops and reps.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Facebook className="w-5 h-5 text-blue-600" />
              Business Connection
            </CardTitle>
            <CardDescription>
              Connect a Business account to enable Page messaging automation and webhooks.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-center gap-3">
              <Button onClick={handleConnectBusiness} disabled={isConnectingBusiness}>
                <Link2 className="w-4 h-4 mr-2" />
                {isConnectingBusiness ? "Connecting..." : "Connect Business"}
              </Button>
              <p className="text-xs text-muted-foreground">
                Use a Business Admin account to authorize Pages.
              </p>
            </div>

            {businessAccounts.length === 0 ? (
              <div className="text-sm text-muted-foreground">No Business accounts connected yet.</div>
            ) : (
              <div className="space-y-4">
                {businessAccounts.map((account) => {
                  const tokenExpiry = account.tokenExpiresAt ? new Date(account.tokenExpiresAt) : null;
                  const tokenActive = tokenExpiry ? tokenExpiry > new Date() : false;
                  return (
                    <div key={account.id} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="font-medium">{account.businessName || "Business Account"}</div>
                          <div className="text-xs text-muted-foreground">Business ID: {account.businessId}</div>
                        </div>
                        <Badge variant={tokenActive ? "default" : "secondary"}>
                          {tokenActive ? "Token Active" : "Token Unknown"}
                        </Badge>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2">
                        <div>
                          <Label htmlFor={`system-user-id-${account.id}`}>System User ID</Label>
                          <Input
                            id={`system-user-id-${account.id}`}
                            placeholder="Optional"
                            value={systemUserForms[account.businessId]?.systemUserId || ""}
                            onChange={(e) =>
                              setSystemUserForms((prev) => ({
                                ...prev,
                                [account.businessId]: {
                                  systemUserId: e.target.value,
                                  systemUserToken: prev[account.businessId]?.systemUserToken || "",
                                },
                              }))
                            }
                          />
                        </div>
                        <div>
                          <Label htmlFor={`system-user-token-${account.id}`}>System User Token</Label>
                          <Textarea
                            id={`system-user-token-${account.id}`}
                            placeholder="Paste System User token here..."
                            className="min-h-[90px]"
                            value={systemUserForms[account.businessId]?.systemUserToken || ""}
                            onChange={(e) =>
                              setSystemUserForms((prev) => ({
                                ...prev,
                                [account.businessId]: {
                                  systemUserId: prev[account.businessId]?.systemUserId || "",
                                  systemUserToken: e.target.value,
                                },
                              }))
                            }
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="text-xs text-muted-foreground">
                          Token expires: {tokenExpiry ? tokenExpiry.toLocaleDateString() : "Unknown"}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSaveSystemUserToken(account.businessId)}
                        >
                          <Save className="w-4 h-4 mr-2" />
                          Save Token
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Webhook className="w-5 h-5 text-emerald-600" />
              Webhook Setup
            </CardTitle>
            <CardDescription>
              Subscribe your Pages to Messenger webhooks using this callback URL.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-col md:flex-row md:items-center gap-3">
              <Input value={webhookUrl} readOnly />
              <Button variant="outline" onClick={() => copyToClipboard(webhookUrl, "Webhook URL")}>
                <Copy className="w-4 h-4 mr-2" />
                Copy
              </Button>
            </div>
            <div className="flex flex-col md:flex-row md:items-center gap-3">
              <Button
                variant="outline"
                onClick={() => handleSubscribePages()}
                disabled={isSubscribingPages || connectedPages.length === 0}
              >
                <Webhook className="w-4 h-4 mr-2" />
                {isSubscribingPages ? "Subscribing..." : "Subscribe Pages"}
              </Button>
              <p className="text-xs text-muted-foreground">
                Auto-register connected Pages with your app for webhook events.
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Verify token must match FACEBOOK_WEBHOOK_VERIFY_TOKEN in your environment.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="w-5 h-5 text-indigo-600" />
              Page Routing & DM Links
            </CardTitle>
            <CardDescription>
              Assign Pages to rooftops and store DM links for Marketplace CTA.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="dealership-dm-link">Default Page DM Link (Fallback)</Label>
              <div className="flex flex-col md:flex-row gap-2 mt-2">
                <Input
                  id="dealership-dm-link"
                  placeholder="https://m.me/yourdealership"
                  value={dealershipDmLink}
                  onChange={(e) => setDealershipDmLink(e.target.value)}
                />
                <Button onClick={handleSaveDealershipDmLink} disabled={isSavingDealershipDmLink}>
                  <Save className="w-4 h-4 mr-2" />
                  Save
                </Button>
              </div>
            </div>

            {connectedPages.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                No Pages connected yet. Connect a Business account to sync Pages.
              </div>
            ) : (
              <div className="space-y-4">
                {connectedPages.map((page) => {
                  const webhookLabel =
                    page.webhookSubscribed === true
                      ? "Webhook OK"
                      : page.webhookSubscribed === false
                        ? "Webhook Off"
                        : "Webhook Unknown";
                  const webhookVariant = page.webhookSubscribed === true ? "default" : "secondary";
                  const canSubscribe = page.hasValidToken && page.webhookSubscribed !== true;

                  return (
                    <div key={page.id} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="font-medium">{page.pageName}</div>
                          <div className="text-xs text-muted-foreground">Page ID: {page.pageId}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={page.hasValidToken ? "default" : "secondary"}>
                            {page.hasValidToken ? "Token OK" : "Reconnect"}
                          </Badge>
                          <Badge variant={webhookVariant}>{webhookLabel}</Badge>
                        </div>
                      </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div>
                        <Label htmlFor={`page-dm-${page.pageId}`}>Page DM Link</Label>
                        <Input
                          id={`page-dm-${page.pageId}`}
                          placeholder="https://m.me/yourpage"
                          value={pageMetaEdits[page.pageId]?.pageDmLink || ""}
                          onChange={(e) =>
                            setPageMetaEdits((prev) => ({
                              ...prev,
                              [page.pageId]: {
                                pageDmLink: e.target.value,
                                rooftopId: prev[page.pageId]?.rooftopId || "",
                              },
                            }))
                          }
                        />
                        {!pageMetaEdits[page.pageId]?.pageDmLink && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Uses dealership default if blank.
                          </p>
                        )}
                      </div>
                      <div>
                        <Label>Rooftop</Label>
                        <Select
                          value={pageMetaEdits[page.pageId]?.rooftopId || "unassigned"}
                          onValueChange={(value) =>
                            setPageMetaEdits((prev) => ({
                              ...prev,
                              [page.pageId]: {
                                pageDmLink: prev[page.pageId]?.pageDmLink || "",
                                rooftopId: value === "unassigned" ? "" : value,
                              },
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Unassigned" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unassigned">Unassigned</SelectItem>
                            {rooftops.map((rooftop) => (
                              <SelectItem key={rooftop.id} value={String(rooftop.id)}>
                                {rooftop.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSubscribePages([page.pageId])}
                        disabled={!canSubscribe || subscribingPageId === page.pageId}
                      >
                        <Webhook className="w-4 h-4 mr-2" />
                        {subscribingPageId === page.pageId ? "Subscribing..." : "Subscribe"}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleSavePageMeta(page.pageId)}>
                        <Save className="w-4 h-4 mr-2" />
                        Save Page
                      </Button>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="w-5 h-5 text-slate-600" />
              Rooftops
            </CardTitle>
            <CardDescription>Create rooftops to route Page conversations and reporting.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-col md:flex-row gap-2">
              <Input
                placeholder="Rooftop name"
                value={newRooftopName}
                onChange={(e) => setNewRooftopName(e.target.value)}
              />
              <Button onClick={handleCreateRooftop} disabled={isCreatingRooftop || !newRooftopName.trim()}>
                <Plus className="w-4 h-4 mr-2" />
                Add Rooftop
              </Button>
            </div>
            {rooftops.length === 0 ? (
              <div className="text-sm text-muted-foreground">No rooftops created yet.</div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {rooftops.map((rooftop) => (
                  <Badge key={rooftop.id} variant="outline">
                    {rooftop.name}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-slate-600" />
              Rooftop Routing Teams
            </CardTitle>
            <CardDescription>
              Auto-assign incoming Page DMs to reps who are enabled for each rooftop.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <div>Rooftops covered: {membershipSummary.rooftopsWithCoverage}/{rooftops.length}</div>
              <div>Active assignments: {membershipSummary.total}</div>
            </div>

            {rooftops.length === 0 ? (
              <div className="text-sm text-muted-foreground">Create a rooftop to assign reps.</div>
            ) : salespeople.length === 0 ? (
              <div className="text-sm text-muted-foreground">No salespeople found to assign.</div>
            ) : (
              <div className="space-y-4">
                {rooftops.map((rooftop) => (
                  <div key={rooftop.id} className="border rounded-lg p-4 space-y-3">
                    <div className="font-medium">{rooftop.name}</div>
                    <div className="grid gap-3 md:grid-cols-2">
                      {salespeople.map((salesperson) => {
                        const isEnabled = rooftopMemberships[rooftop.id]?.[salesperson.id] || false;
                        const savingKey = `${rooftop.id}:${salesperson.id}`;
                        return (
                          <div key={salesperson.id} className="flex items-center justify-between border rounded-md px-3 py-2">
                            <div>
                              <div className="text-sm font-medium">{salesperson.name}</div>
                              <div className="text-xs text-muted-foreground">{salesperson.role}</div>
                            </div>
                            <Switch
                              checked={isEnabled}
                              onCheckedChange={(checked) => handleToggleMembership(rooftop.id, salesperson, checked)}
                              disabled={membershipSavingKey === savingKey}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
