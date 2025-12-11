import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Copy,
  Check,
  RefreshCw,
  ExternalLink,
  Image as ImageIcon,
  Sparkles,
  Clock,
  Car,
  DollarSign,
  Gauge,
  ArrowLeft,
  CheckCircle,
  Facebook,
  Download,
  Zap,
  AlertCircle
} from "lucide-react";
import { Link } from "wouter";

interface SocialTemplates {
  marketplace: {
    title: string;
    description: string;
  };
  pagePost?: {
    body: string;
  };
  reply?: {
    message: string;
  };
}

interface BlastVehicle {
  id: number;
  year: number;
  make: string;
  model: string;
  trim: string;
  type: string;
  price: number;
  odometer: number;
  images: string[];
  location: string;
  dealership: string;
  daysInStock: number;
  socialTemplates: SocialTemplates | null;
  socialTemplatesGeneratedAt: string | null;
  marketplacePostedAt: string | null;
  vin: string | null;
  stockNumber: string | null;
  carfaxUrl: string | null;
  badges: string[];
}

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopy = async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopied(true);
      toast({ title: "Copied!", description: "Text copied to clipboard" });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({ title: "Copy failed", description: "Please copy manually", variant: "destructive" });
    }
  };

  return (
    <Button
      type="button"
      variant={copied ? "default" : "outline"}
      size="sm"
      onClick={handleCopy}
      className="gap-2"
      data-testid={`copy-${label.toLowerCase().replace(/\s/g, '-')}`}
    >
      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
      {copied ? "Copied!" : label}
    </Button>
  );
}

export default function MarketplaceBlast() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedVehicle, setSelectedVehicle] = useState<BlastVehicle | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showPosted, setShowPosted] = useState(false);

  // Fetch queue
  const { data: queueData, isLoading, refetch } = useQuery<{ vehicles: BlastVehicle[]; total: number }>({
    queryKey: ['marketplace-blast-queue', showPosted],
    queryFn: async () => {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`/api/marketplace-blast/queue?includePosted=${showPosted}&limit=100`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch queue');
      return res.json();
    }
  });

  // Generate content mutation
  const generateMutation = useMutation({
    mutationFn: async (vehicleId: number) => {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`/api/marketplace-blast/generate/${vehicleId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to generate content');
      return res.json();
    },
    onSuccess: (data, vehicleId) => {
      queryClient.invalidateQueries({ queryKey: ['marketplace-blast-queue'] });
      if (selectedVehicle?.id === vehicleId) {
        setSelectedVehicle(prev => prev ? { ...prev, socialTemplates: data.templates } : null);
      }
      toast({ title: "Content generated!", description: "AI has created your Marketplace listing" });
    },
    onError: () => {
      toast({ title: "Generation failed", description: "Please try again", variant: "destructive" });
    }
  });

  // Mark as posted mutation
  const markPostedMutation = useMutation({
    mutationFn: async (vehicleId: number) => {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`/api/marketplace-blast/mark-posted/${vehicleId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to mark as posted');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketplace-blast-queue'] });
      setSelectedVehicle(null);
      toast({ title: "Marked as posted!", description: "Vehicle removed from queue" });
    }
  });

  // Filter vehicles by search
  const filteredVehicles = (queueData?.vehicles || []).filter(v => {
    if (!searchQuery) return true;
    const search = searchQuery.toLowerCase();
    return (
      v.make.toLowerCase().includes(search) ||
      v.model.toLowerCase().includes(search) ||
      v.year.toString().includes(search) ||
      v.stockNumber?.toLowerCase().includes(search)
    );
  });

  const openMarketplace = () => {
    window.open('https://www.facebook.com/marketplace/create/item', '_blank');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/sales">
                <Button variant="ghost" size="sm" data-testid="back-button">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  <Zap className="w-6 h-6 text-blue-500" />
                  Marketplace Blast
                </h1>
                <p className="text-sm text-muted-foreground">
                  Post vehicles to Facebook Marketplace in seconds
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPosted(!showPosted)}
                data-testid="toggle-posted"
              >
                {showPosted ? "Hide Posted" : "Show Posted"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                disabled={isLoading}
                data-testid="refresh-queue"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <div className="flex gap-6 h-[calc(100vh-180px)]">
          {/* Left: Vehicle Queue */}
          <div className="w-96 flex flex-col">
            <Card className="flex-1 flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">
                    Ready to Post ({filteredVehicles.length})
                  </CardTitle>
                </div>
                <Input
                  placeholder="Search vehicles..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="mt-2"
                  data-testid="search-vehicles"
                />
              </CardHeader>
              <CardContent className="flex-1 p-0">
                <ScrollArea className="h-full">
                  <div className="p-4 space-y-3">
                    {isLoading ? (
                      <div className="space-y-3">
                        {[1, 2, 3, 4].map(i => (
                          <div key={i} className="h-24 bg-muted rounded-lg animate-pulse" />
                        ))}
                      </div>
                    ) : filteredVehicles.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Car className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>No vehicles in queue</p>
                      </div>
                    ) : (
                      filteredVehicles.map(vehicle => (
                        <div
                          key={vehicle.id}
                          onClick={() => setSelectedVehicle(vehicle)}
                          className={`p-3 rounded-lg border cursor-pointer transition-all hover:border-primary ${
                            selectedVehicle?.id === vehicle.id ? 'border-primary bg-primary/5' : ''
                          }`}
                          data-testid={`vehicle-card-${vehicle.id}`}
                        >
                          <div className="flex gap-3">
                            {vehicle.images?.[0] ? (
                              <img
                                src={vehicle.images[0]}
                                alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
                                className="w-20 h-16 object-cover rounded"
                              />
                            ) : (
                              <div className="w-20 h-16 bg-muted rounded flex items-center justify-center">
                                <Car className="w-8 h-8 text-muted-foreground" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <h3 className="font-medium text-sm truncate">
                                {vehicle.year} {vehicle.make} {vehicle.model}
                              </h3>
                              <p className="text-xs text-muted-foreground truncate">{vehicle.trim}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="secondary" className="text-xs">
                                  ${vehicle.price.toLocaleString()}
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                  {vehicle.daysInStock}d
                                </Badge>
                                {vehicle.socialTemplates && (
                                  <Badge variant="default" className="text-xs bg-green-500">
                                    <Sparkles className="w-3 h-3 mr-1" />
                                    Ready
                                  </Badge>
                                )}
                                {vehicle.marketplacePostedAt && (
                                  <Badge variant="outline" className="text-xs text-blue-500">
                                    <CheckCircle className="w-3 h-3 mr-1" />
                                    Posted
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Right: Vehicle Detail & Copy Tools */}
          <div className="flex-1">
            {selectedVehicle ? (
              <Card className="h-full flex flex-col">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-xl">
                        {selectedVehicle.year} {selectedVehicle.make} {selectedVehicle.model}
                      </CardTitle>
                      <p className="text-muted-foreground">{selectedVehicle.trim}</p>
                    </div>
                    <Button
                      onClick={openMarketplace}
                      className="bg-blue-600 hover:bg-blue-700"
                      data-testid="open-marketplace"
                    >
                      <Facebook className="w-4 h-4 mr-2" />
                      Open Marketplace
                      <ExternalLink className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                  
                  {/* Quick Stats */}
                  <div className="flex gap-4 mt-4">
                    <div className="flex items-center gap-2 text-sm">
                      <DollarSign className="w-4 h-4 text-green-500" />
                      <span className="font-medium">${selectedVehicle.price.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Gauge className="w-4 h-4 text-blue-500" />
                      <span>{selectedVehicle.odometer.toLocaleString()} km</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="w-4 h-4 text-orange-500" />
                      <span>{selectedVehicle.daysInStock} days in stock</span>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="flex-1 overflow-auto">
                  {/* Generate Content Button */}
                  {!selectedVehicle.socialTemplates && (
                    <div className="mb-6 p-4 bg-muted rounded-lg text-center">
                      <AlertCircle className="w-8 h-8 mx-auto mb-2 text-amber-500" />
                      <p className="text-sm text-muted-foreground mb-3">
                        No content generated yet. Click below to create AI-powered listing copy.
                      </p>
                      <Button
                        onClick={() => generateMutation.mutate(selectedVehicle.id)}
                        disabled={generateMutation.isPending}
                        data-testid="generate-content"
                      >
                        {generateMutation.isPending ? (
                          <>
                            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4 mr-2" />
                            Generate AI Content
                          </>
                        )}
                      </Button>
                    </div>
                  )}

                  {/* Marketplace Content */}
                  {selectedVehicle.socialTemplates && (
                    <div className="space-y-6">
                      {/* Title Section */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-semibold text-sm uppercase text-muted-foreground">
                            Marketplace Title
                          </h3>
                          <div className="flex gap-2">
                            <CopyButton 
                              text={selectedVehicle.socialTemplates.marketplace.title} 
                              label="Copy Title" 
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => generateMutation.mutate(selectedVehicle.id)}
                              disabled={generateMutation.isPending}
                              data-testid="regenerate-content"
                            >
                              <RefreshCw className={`w-4 h-4 ${generateMutation.isPending ? 'animate-spin' : ''}`} />
                            </Button>
                          </div>
                        </div>
                        <div className="p-3 bg-muted rounded-lg">
                          <p className="text-sm">{selectedVehicle.socialTemplates.marketplace.title}</p>
                        </div>
                      </div>

                      <Separator />

                      {/* Description Section */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-semibold text-sm uppercase text-muted-foreground">
                            Marketplace Description
                          </h3>
                          <CopyButton 
                            text={selectedVehicle.socialTemplates.marketplace.description} 
                            label="Copy Description" 
                          />
                        </div>
                        <div className="p-3 bg-muted rounded-lg">
                          <p className="text-sm whitespace-pre-wrap">
                            {selectedVehicle.socialTemplates.marketplace.description}
                          </p>
                        </div>
                      </div>

                      <Separator />

                      {/* Copy All Button */}
                      <div className="flex justify-center">
                        <CopyButton
                          text={`${selectedVehicle.socialTemplates.marketplace.title}\n\n${selectedVehicle.socialTemplates.marketplace.description}`}
                          label="Copy Title + Description"
                        />
                      </div>

                      <Separator />

                      {/* Photos Section */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-semibold text-sm uppercase text-muted-foreground">
                            Photos ({selectedVehicle.images?.length || 0})
                          </h3>
                        </div>
                        <div className="grid grid-cols-5 gap-2">
                          {selectedVehicle.images?.slice(0, 10).map((img, idx) => (
                            <a
                              key={idx}
                              href={img}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="aspect-square rounded overflow-hidden hover:opacity-80 transition-opacity"
                            >
                              <img
                                src={img}
                                alt={`Photo ${idx + 1}`}
                                className="w-full h-full object-cover"
                              />
                            </a>
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          Click photos to open in new tab, then right-click to save
                        </p>
                      </div>

                      {/* Reply Template */}
                      {selectedVehicle.socialTemplates.reply && (
                        <>
                          <Separator />
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <h3 className="font-semibold text-sm uppercase text-muted-foreground">
                                Quick Reply (when someone asks "Is this available?")
                              </h3>
                              <CopyButton 
                                text={selectedVehicle.socialTemplates.reply.message} 
                                label="Copy Reply" 
                              />
                            </div>
                            <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                              <p className="text-sm">{selectedVehicle.socialTemplates.reply.message}</p>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </CardContent>

                {/* Footer Actions */}
                <div className="p-4 border-t bg-muted/30 flex items-center justify-between">
                  <Button
                    variant="outline"
                    onClick={() => setSelectedVehicle(null)}
                    data-testid="close-detail"
                  >
                    Close
                  </Button>
                  <div className="flex gap-2">
                    <Button
                      onClick={openMarketplace}
                      variant="outline"
                      data-testid="open-marketplace-footer"
                    >
                      <Facebook className="w-4 h-4 mr-2" />
                      Open Marketplace
                    </Button>
                    <Button
                      onClick={() => markPostedMutation.mutate(selectedVehicle.id)}
                      disabled={markPostedMutation.isPending}
                      className="bg-green-600 hover:bg-green-700"
                      data-testid="mark-posted"
                    >
                      {markPostedMutation.isPending ? (
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <CheckCircle className="w-4 h-4 mr-2" />
                      )}
                      Mark as Posted
                    </Button>
                  </div>
                </div>
              </Card>
            ) : (
              <Card className="h-full flex items-center justify-center">
                <div className="text-center p-8">
                  <Car className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <h3 className="text-lg font-medium mb-2">Select a Vehicle</h3>
                  <p className="text-muted-foreground text-sm max-w-sm">
                    Click on a vehicle from the queue to view its AI-generated listing content
                    and post it to Facebook Marketplace.
                  </p>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
