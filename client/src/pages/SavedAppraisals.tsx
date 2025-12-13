import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ChevronLeft,
  Search,
  MoreVertical,
  Trash2,
  Eye,
  Loader2,
  FileText,
  ChevronRight,
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

type Appraisal = {
  id: number;
  vin: string;
  year: number;
  make: string;
  model: string;
  trim?: string;
  mileage?: number;
  status: string;
  averageMarketPrice?: number;
  suggestedBuyPrice?: number;
  quotedPrice?: number;
  actualSalePrice?: number;
  missedReason?: string;
  missedNotes?: string;
  tradeinValue?: number;
  wholesaleValue?: number;
  retailValue?: number;
  createdAt: string;
  createdBy?: number;
};

type AppraisalsResponse = {
  appraisals: Appraisal[];
  total: number;
  limit: number;
  offset: number;
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400",
  quoted: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  purchased: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  passed: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "draft", label: "Draft" },
  { value: "quoted", label: "Quoted" },
  { value: "purchased", label: "Purchased" },
  { value: "passed", label: "Passed" },
];

const MISSED_REASON_OPTIONS = [
  { value: "lost_to_competitor", label: "Lost to Competitor" },
  { value: "customer_declined", label: "Customer Declined" },
  { value: "price_too_high", label: "Price Too High" },
  { value: "wholesaled", label: "Sent to Wholesale" },
  { value: "other", label: "Other" },
];

export default function SavedAppraisals() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(0);
  const [activeTab, setActiveTab] = useState("appraisals");
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);
  const [passedDialogOpen, setPassedDialogOpen] = useState(false);
  const [selectedAppraisal, setSelectedAppraisal] = useState<Appraisal | null>(null);
  const [actualSalePrice, setActualSalePrice] = useState("");
  const [priceError, setPriceError] = useState("");
  const [missedReason, setMissedReason] = useState("customer_declined");
  const [missedNotes, setMissedNotes] = useState("");
  const limit = 20;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery<AppraisalsResponse>({
    queryKey: ["appraisals", search, status, page],
    queryFn: async () => {
      const token = localStorage.getItem("auth_token");
      const params = new URLSearchParams();
      params.append("limit", limit.toString());
      params.append("offset", (page * limit).toString());
      if (search) params.append("search", search);
      if (status && status !== "all") params.append("status", status);

      const res = await fetch(`/api/manager/appraisals?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch appraisals");
      return res.json();
    },
  });

  type StatsResponse = {
    purchased: number;
    passed: number;
    lookToBookRatio: string;
    totalQuoted: number;
    totalActual: number;
    accuracyVariance: number;
  };

  const { data: stats } = useQuery<StatsResponse>({
    queryKey: ["appraisal-stats"],
    queryFn: async () => {
      const token = localStorage.getItem("auth_token");
      const res = await fetch("/api/manager/appraisals/stats", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
  });

  const updateAppraisalMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: Record<string, any> }) => {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`/api/manager/appraisals/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error("Failed to update appraisal");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appraisals"] });
      queryClient.invalidateQueries({ queryKey: ["appraisal-stats"] });
      toast({ title: "Appraisal updated" });
    },
    onError: () => {
      toast({ title: "Failed to update appraisal", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`/api/manager/appraisals/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to delete appraisal");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appraisals"] });
      toast({ title: "Appraisal deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete appraisal", variant: "destructive" });
    },
  });

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this appraisal?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleStatusChange = (appraisal: Appraisal, newStatus: string) => {
    if (newStatus === "purchased") {
      setSelectedAppraisal(appraisal);
      setActualSalePrice(appraisal.quotedPrice ? (appraisal.quotedPrice / 100).toString() : "");
      setPriceError("");
      setPurchaseDialogOpen(true);
    } else if (newStatus === "passed") {
      setSelectedAppraisal(appraisal);
      setMissedReason("customer_declined");
      setMissedNotes("");
      setPassedDialogOpen(true);
    } else {
      updateAppraisalMutation.mutate({ id: appraisal.id, updates: { status: newStatus } });
    }
  };

  const handleConfirmPurchase = () => {
    if (!selectedAppraisal) return;
    
    const priceValue = parseFloat(actualSalePrice);
    if (!actualSalePrice.trim() || isNaN(priceValue) || priceValue <= 0) {
      setPriceError("Please enter a valid price greater than $0");
      return;
    }
    
    setPriceError("");
    const priceInCents = Math.round(priceValue * 100);
    updateAppraisalMutation.mutate({
      id: selectedAppraisal.id,
      updates: {
        status: "purchased",
        actualSalePrice: priceInCents,
      },
    });
    setPurchaseDialogOpen(false);
    setSelectedAppraisal(null);
  };

  const handleConfirmPassed = () => {
    if (!selectedAppraisal) return;
    updateAppraisalMutation.mutate({
      id: selectedAppraisal.id,
      updates: {
        status: "passed",
        missedReason,
        missedNotes,
      },
    });
    setPassedDialogOpen(false);
    setSelectedAppraisal(null);
  };

  const appraisals = data?.appraisals || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / limit);

  const lookToBookRatio = stats?.lookToBookRatio || "0";
  const purchasedCount = stats?.purchased || 0;
  const passedCount = stats?.passed || 0;
  const totalActual = stats?.totalActual || 0;
  const accuracyVariance = stats?.accuracyVariance || 0;

  const formatPrice = (price?: number) => {
    if (!price) return "-";
    return new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency: "CAD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price / 100);
  };

  const formatPriceDollars = (price: number) => {
    return new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency: "CAD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <header className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/manager">
                <Button variant="ghost" size="icon" data-testid="button-back">
                  <ChevronLeft className="w-5 h-5" />
                </Button>
              </Link>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#022d60] to-[#00aad2] flex items-center justify-center">
                  <FileText className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                    Saved Appraisals
                  </h1>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Track and manage vehicle appraisals
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Look-to-Book Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card data-testid="card-look-to-book">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Look-to-Book Ratio
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {lookToBookRatio}%
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {purchasedCount} purchased / {purchasedCount + passedCount} decided
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-purchased">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                Purchased
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {purchasedCount}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {formatPrice(totalActual)} total
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-passed">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <XCircle className="w-4 h-4 text-red-500" />
                Passed/Missed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                {passedCount}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Missed opportunities
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-accuracy">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Pricing Accuracy
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${accuracyVariance >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {accuracyVariance >= 0 ? '+' : ''}{accuracyVariance.toFixed(1)}%
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Actual vs quoted variance
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="p-4 border-b border-slate-200 dark:border-slate-700">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search by VIN, make, model..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(0);
                  }}
                  className="pl-10"
                  data-testid="input-search"
                />
              </div>
              <Select
                value={status}
                onValueChange={(value) => {
                  setStatus(value);
                  setPage(0);
                }}
              >
                <SelectTrigger className="w-[180px]" data-testid="select-status">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
            </div>
          ) : error ? (
            <div className="text-center py-12 text-red-500">
              Failed to load appraisals
            </div>
          ) : appraisals.length === 0 ? (
            <div className="text-center py-12 text-slate-500 dark:text-slate-400">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No appraisals found</p>
              <p className="text-sm mt-1">Run a VIN decode or market analysis to create appraisals</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>VIN</TableHead>
                      <TableHead>Vehicle</TableHead>
                      <TableHead>Mileage</TableHead>
                      <TableHead>Avg Market Price</TableHead>
                      <TableHead>Buy Price</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {appraisals.map((appraisal) => (
                      <TableRow
                        key={appraisal.id}
                        className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50"
                        data-testid={`row-appraisal-${appraisal.id}`}
                      >
                        <TableCell className="font-mono text-sm">
                          {appraisal.vin}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">
                            {appraisal.year} {appraisal.make} {appraisal.model}
                          </div>
                          {appraisal.trim && (
                            <div className="text-sm text-slate-500">{appraisal.trim}</div>
                          )}
                        </TableCell>
                        <TableCell>
                          {appraisal.mileage
                            ? `${appraisal.mileage.toLocaleString()} km`
                            : "-"}
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatPrice(appraisal.averageMarketPrice)}
                        </TableCell>
                        <TableCell className="font-medium text-green-600 dark:text-green-400">
                          {formatPrice(appraisal.suggestedBuyPrice)}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={appraisal.status}
                            onValueChange={(value) => handleStatusChange(appraisal, value)}
                          >
                            <SelectTrigger
                              className="w-[120px] h-8"
                              data-testid={`select-status-${appraisal.id}`}
                            >
                              <Badge
                                className={`${STATUS_COLORS[appraisal.status] || STATUS_COLORS.draft} border-0`}
                              >
                                {appraisal.status.charAt(0).toUpperCase() +
                                  appraisal.status.slice(1)}
                              </Badge>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="draft">Draft</SelectItem>
                              <SelectItem value="quoted">Quoted</SelectItem>
                              <SelectItem value="purchased">Purchased</SelectItem>
                              <SelectItem value="passed">Passed</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-sm text-slate-500">
                          {format(new Date(appraisal.createdAt), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                data-testid={`button-actions-${appraisal.id}`}
                              >
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => {
                                  window.location.href = `/manager?vin=${appraisal.vin}`;
                                }}
                                data-testid={`action-view-${appraisal.id}`}
                              >
                                <Eye className="w-4 h-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDelete(appraisal.id)}
                                className="text-red-600"
                                data-testid={`action-delete-${appraisal.id}`}
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-700">
                  <div className="text-sm text-slate-500">
                    Showing {page * limit + 1} to{" "}
                    {Math.min((page + 1) * limit, total)} of {total} appraisals
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                      disabled={page === 0}
                      data-testid="button-prev-page"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-sm text-slate-600 dark:text-slate-300">
                      Page {page + 1} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                      disabled={page >= totalPages - 1}
                      data-testid="button-next-page"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Purchase Confirmation Dialog */}
      <Dialog open={purchaseDialogOpen} onOpenChange={setPurchaseDialogOpen}>
        <DialogContent data-testid="dialog-purchase">
          <DialogHeader>
            <DialogTitle>Confirm Purchase</DialogTitle>
          </DialogHeader>
          {selectedAppraisal && (
            <div className="space-y-4">
              <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-lg">
                <p className="font-medium">
                  {selectedAppraisal.year} {selectedAppraisal.make} {selectedAppraisal.model}
                </p>
                <p className="text-sm text-slate-500">{selectedAppraisal.vin}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-slate-500">Quoted Price:</span>
                  <p className="font-medium">{formatPrice(selectedAppraisal.quotedPrice)}</p>
                </div>
                <div>
                  <span className="text-slate-500">Suggested Buy:</span>
                  <p className="font-medium text-green-600">{formatPrice(selectedAppraisal.suggestedBuyPrice)}</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="actualSalePrice">Actual Purchase Price</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    id="actualSalePrice"
                    type="number"
                    placeholder="Enter actual price paid"
                    value={actualSalePrice}
                    onChange={(e) => {
                      setActualSalePrice(e.target.value);
                      if (priceError) setPriceError("");
                    }}
                    className={`pl-10 ${priceError ? 'border-red-500' : ''}`}
                    data-testid="input-actual-price"
                  />
                </div>
                {priceError && (
                  <p className="text-sm text-red-500 flex items-center gap-1" data-testid="text-price-error">
                    <AlertCircle className="w-4 h-4" />
                    {priceError}
                  </p>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPurchaseDialogOpen(false)} data-testid="button-cancel-purchase">
              Cancel
            </Button>
            <Button 
              onClick={handleConfirmPurchase} 
              disabled={!actualSalePrice}
              data-testid="button-confirm-purchase"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Confirm Purchase
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Passed/Missed Confirmation Dialog */}
      <Dialog open={passedDialogOpen} onOpenChange={setPassedDialogOpen}>
        <DialogContent data-testid="dialog-passed">
          <DialogHeader>
            <DialogTitle>Record Missed Trade</DialogTitle>
          </DialogHeader>
          {selectedAppraisal && (
            <div className="space-y-4">
              <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-lg">
                <p className="font-medium">
                  {selectedAppraisal.year} {selectedAppraisal.make} {selectedAppraisal.model}
                </p>
                <p className="text-sm text-slate-500">{selectedAppraisal.vin}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="missedReason">Reason for Missing</Label>
                <Select value={missedReason} onValueChange={setMissedReason}>
                  <SelectTrigger data-testid="select-missed-reason">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MISSED_REASON_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="missedNotes">Additional Notes (Optional)</Label>
                <Textarea
                  id="missedNotes"
                  placeholder="Enter any additional details..."
                  value={missedNotes}
                  onChange={(e) => setMissedNotes(e.target.value)}
                  rows={3}
                  data-testid="textarea-missed-notes"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPassedDialogOpen(false)} data-testid="button-cancel-passed">
              Cancel
            </Button>
            <Button 
              onClick={handleConfirmPassed}
              variant="destructive"
              data-testid="button-confirm-passed"
            >
              <XCircle className="w-4 h-4 mr-2" />
              Mark as Missed
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
