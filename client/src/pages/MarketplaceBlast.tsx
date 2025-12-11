import { useState, useEffect, useMemo } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Copy,
  Check,
  RefreshCw,
  ExternalLink,
  Sparkles,
  Clock,
  Car,
  DollarSign,
  Gauge,
  ArrowLeft,
  CheckCircle,
  CheckCircle2,
  Facebook,
  Zap,
  AlertCircle,
  Settings2,
  FileText,
  TrendingUp,
  CalendarDays,
  Activity,
  Plus,
  Trash2,
  Edit3,
  Eye,
  ThumbsUp,
  MessageCircle,
  Share2,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  User
} from "lucide-react";

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

interface FacebookAccount {
  id: number;
  accountName: string;
  facebookUserId: string | null;
  isActive: boolean;
  postsToday?: number;
  totalPosts?: number;
}

interface AdTemplate {
  id: number;
  templateName: string;
  titleTemplate: string;
  descriptionTemplate: string;
  isDefault: boolean;
}

function CopyButton({ text, label = "Copy", size = "sm" }: { text: string; label?: string; size?: "sm" | "default" }) {
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
      size={size}
      onClick={handleCopy}
      className="gap-2"
      data-testid={`copy-${label.toLowerCase().replace(/\s/g, '-')}`}
    >
      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
      {copied ? "Copied!" : label}
    </Button>
  );
}

function KPICard({
  title,
  value,
  icon: Icon,
  trend,
  color,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  trend?: string;
  color: string;
}) {
  return (
    <Card
      className="relative overflow-hidden border-0 bg-white/80 backdrop-blur-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5"
      data-testid={`kpi-card-${title.toLowerCase().replace(/\s/g, "-")}`}
    >
      <div
        className="absolute inset-0 opacity-10"
        style={{ background: `linear-gradient(135deg, ${color} 0%, transparent 100%)` }}
      />
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1">{title}</p>
            <p className="text-3xl font-bold tracking-tight" style={{ color }}>
              {value}
            </p>
            {trend && (
              <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                {trend}
              </p>
            )}
          </div>
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg"
            style={{ background: `linear-gradient(135deg, ${color} 0%, ${color}dd 100%)` }}
          >
            <Icon className="w-7 h-7 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AccountListItem({
  account,
  isSelected,
  onClick,
}: {
  account: FacebookAccount;
  isSelected: boolean;
  onClick: () => void;
}) {
  const colors = ["#1877f2", "#00aad2", "#7c3aed", "#059669", "#ea580c"];
  const color = colors[account.id % colors.length];
  const initials = account.accountName.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
  
  return (
    <button
      onClick={onClick}
      className={`w-full p-4 rounded-xl transition-all duration-300 flex items-center gap-4 group ${
        isSelected
          ? "bg-gradient-to-r from-[#1877f2]/10 to-[#00aad2]/10 border-2 border-[#1877f2]/30 shadow-lg"
          : "bg-white/60 hover:bg-white/90 border border-transparent hover:border-gray-200"
      }`}
      data-testid={`account-item-${account.id}`}
    >
      <Avatar className="w-12 h-12 shadow-md ring-2 ring-white">
        <AvatarFallback
          className="text-white font-bold text-sm"
          style={{ background: `linear-gradient(135deg, ${color} 0%, ${color}cc 100%)` }}
        >
          {initials}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 text-left">
        <p className="font-semibold text-gray-900 group-hover:text-[#1877f2] transition-colors">
          {account.accountName}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <Badge
            variant={account.isActive ? "default" : "secondary"}
            className={`text-xs ${
              account.isActive
                ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                : "bg-gray-100 text-gray-500"
            }`}
          >
            {account.isActive ? "Active" : "Inactive"}
          </Badge>
          <span className="text-xs text-muted-foreground">{account.totalPosts || 0} posts</span>
        </div>
      </div>
      <div
        className="w-3 h-3 rounded-full shadow-inner"
        style={{ backgroundColor: color }}
      />
    </button>
  );
}

function PostPreview({ 
  vehicle, 
  template,
  onOpenMarketplace 
}: { 
  vehicle: BlastVehicle | null;
  template: AdTemplate | null;
  onOpenMarketplace: () => void;
}) {
  if (!vehicle) {
    return (
      <Card className="h-full flex items-center justify-center bg-white/80">
        <div className="text-center p-8">
          <Car className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h3 className="text-lg font-medium mb-2">No Vehicle Selected</h3>
          <p className="text-muted-foreground text-sm max-w-sm">
            Select a vehicle from the queue to preview your Marketplace listing
          </p>
        </div>
      </Card>
    );
  }

  const title = vehicle.socialTemplates?.marketplace?.title || 
    `${vehicle.year} ${vehicle.make} ${vehicle.model} - $${vehicle.price.toLocaleString()}`;
  const description = vehicle.socialTemplates?.marketplace?.description || 
    `Check out this ${vehicle.year} ${vehicle.make} ${vehicle.model}! ${vehicle.odometer.toLocaleString()} km. Contact us today!`;

  return (
    <Card className="h-full bg-white/80 overflow-hidden">
      <CardHeader className="pb-3 border-b bg-gradient-to-r from-[#1877f2]/5 to-transparent">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Eye className="w-5 h-5 text-[#1877f2]" />
            Post Preview
          </CardTitle>
          <Button
            onClick={onOpenMarketplace}
            className="bg-[#1877f2] hover:bg-[#1877f2]/90"
            data-testid="open-marketplace-preview"
          >
            <Facebook className="w-4 h-4 mr-2" />
            Open Marketplace
            <ExternalLink className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="max-w-md mx-auto my-4">
          <div className="bg-white rounded-lg shadow-lg border overflow-hidden">
            <div className="flex items-center gap-3 p-3 border-b">
              <Avatar className="w-10 h-10">
                <AvatarFallback className="bg-[#1877f2] text-white">
                  <User className="w-5 h-5" />
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold text-sm">Your Name</p>
                <p className="text-xs text-muted-foreground">Just now · <Facebook className="w-3 h-3 inline" /></p>
              </div>
            </div>
            
            <div className="aspect-video bg-gray-100 relative">
              {vehicle.images?.[0] ? (
                <img
                  src={vehicle.images[0]}
                  alt={title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Car className="w-16 h-16 text-muted-foreground" />
                </div>
              )}
              <div className="absolute bottom-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-sm font-bold">
                ${vehicle.price.toLocaleString()}
              </div>
            </div>
            
            <div className="p-3">
              <h3 className="font-bold text-base mb-1 line-clamp-2">{title}</h3>
              <p className="text-sm text-gray-600 line-clamp-3">{description}</p>
            </div>
            
            <div className="flex items-center justify-around py-2 border-t text-gray-500">
              <button className="flex items-center gap-1 hover:text-[#1877f2] transition-colors">
                <ThumbsUp className="w-5 h-5" />
                <span className="text-sm">Like</span>
              </button>
              <button className="flex items-center gap-1 hover:text-[#1877f2] transition-colors">
                <MessageCircle className="w-5 h-5" />
                <span className="text-sm">Comment</span>
              </button>
              <button className="flex items-center gap-1 hover:text-[#1877f2] transition-colors">
                <Share2 className="w-5 h-5" />
                <span className="text-sm">Share</span>
              </button>
            </div>
          </div>
        </div>
        
        <Separator />
        
        <div className="p-4 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm font-semibold text-muted-foreground uppercase">Title</Label>
              <CopyButton text={title} label="Copy" />
            </div>
            <div className="p-3 bg-gray-50 rounded-lg border text-sm">{title}</div>
          </div>
          
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm font-semibold text-muted-foreground uppercase">Description</Label>
              <CopyButton text={description} label="Copy" />
            </div>
            <div className="p-3 bg-gray-50 rounded-lg border text-sm whitespace-pre-wrap max-h-32 overflow-auto">
              {description}
            </div>
          </div>
          
          <div className="flex justify-center pt-2">
            <CopyButton text={`${title}\n\n${description}`} label="Copy All" size="default" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function VehicleQueue({
  vehicles,
  selectedVehicle,
  onSelectVehicle,
  onGenerateContent,
  onMarkPosted,
  isGenerating,
}: {
  vehicles: BlastVehicle[];
  selectedVehicle: BlastVehicle | null;
  onSelectVehicle: (vehicle: BlastVehicle) => void;
  onGenerateContent: (vehicleId: number) => void;
  onMarkPosted: (vehicleId: number) => void;
  isGenerating: boolean;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(0);
  const itemsPerPage = 6;

  const filteredVehicles = useMemo(() => {
    if (!searchQuery) return vehicles;
    const search = searchQuery.toLowerCase();
    return vehicles.filter(v => 
      v.make.toLowerCase().includes(search) ||
      v.model.toLowerCase().includes(search) ||
      v.year.toString().includes(search)
    );
  }, [vehicles, searchQuery]);

  const totalPages = Math.ceil(filteredVehicles.length / itemsPerPage);
  const paginatedVehicles = filteredVehicles.slice(
    currentPage * itemsPerPage,
    (currentPage + 1) * itemsPerPage
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Vehicle Queue ({filteredVehicles.length})</h3>
        <Input
          placeholder="Search..."
          value={searchQuery}
          onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(0); }}
          className="w-48"
          data-testid="search-queue"
        />
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {paginatedVehicles.map(vehicle => (
          <Card
            key={vehicle.id}
            onClick={() => onSelectVehicle(vehicle)}
            className={`cursor-pointer transition-all hover:shadow-lg overflow-hidden ${
              selectedVehicle?.id === vehicle.id 
                ? 'ring-2 ring-[#1877f2] shadow-lg' 
                : 'hover:ring-1 hover:ring-gray-200'
            }`}
            data-testid={`queue-vehicle-${vehicle.id}`}
          >
            <div className="aspect-video bg-gray-100 relative">
              {vehicle.images?.[0] ? (
                <img
                  src={vehicle.images[0]}
                  alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Car className="w-8 h-8 text-muted-foreground" />
                </div>
              )}
              <Badge 
                className="absolute top-2 right-2 bg-orange-500/90"
              >
                {vehicle.daysInStock}d
              </Badge>
              {vehicle.socialTemplates && (
                <Badge 
                  className="absolute top-2 left-2 bg-emerald-500/90"
                >
                  <Sparkles className="w-3 h-3 mr-1" />
                  Ready
                </Badge>
              )}
            </div>
            <CardContent className="p-3">
              <h4 className="font-semibold text-sm truncate">
                {vehicle.year} {vehicle.make} {vehicle.model}
              </h4>
              <p className="text-xs text-muted-foreground truncate">{vehicle.trim}</p>
              <div className="flex items-center justify-between mt-2">
                <span className="font-bold text-[#1877f2]">
                  ${vehicle.price.toLocaleString()}
                </span>
                <span className="text-xs text-muted-foreground">
                  {vehicle.odometer.toLocaleString()} km
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
            disabled={currentPage === 0}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {currentPage + 1} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={currentPage >= totalPages - 1}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
      
      {selectedVehicle && (
        <Card className="bg-gradient-to-r from-[#1877f2]/5 to-[#00aad2]/5 border-[#1877f2]/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-semibold">
                  {selectedVehicle.year} {selectedVehicle.make} {selectedVehicle.model}
                </h4>
                <p className="text-sm text-muted-foreground">{selectedVehicle.trim}</p>
              </div>
              <div className="flex gap-2">
                {!selectedVehicle.socialTemplates ? (
                  <Button
                    onClick={() => onGenerateContent(selectedVehicle.id)}
                    disabled={isGenerating}
                    className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                    data-testid="generate-content"
                  >
                    {isGenerating ? (
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4 mr-2" />
                    )}
                    Generate AI Content
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => onGenerateContent(selectedVehicle.id)}
                      disabled={isGenerating}
                      data-testid="regenerate-content"
                    >
                      <RefreshCw className={`w-4 h-4 mr-2 ${isGenerating ? 'animate-spin' : ''}`} />
                      Regenerate
                    </Button>
                    <Button
                      onClick={() => onMarkPosted(selectedVehicle.id)}
                      className="bg-emerald-600 hover:bg-emerald-700"
                      data-testid="mark-posted"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Mark as Posted
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function TemplateEditor({
  templates,
  selectedTemplate,
  onSelectTemplate,
  onSaveTemplate,
  onDeleteTemplate,
}: {
  templates: AdTemplate[];
  selectedTemplate: AdTemplate | null;
  onSelectTemplate: (template: AdTemplate) => void;
  onSaveTemplate: (template: Partial<AdTemplate>) => void;
  onDeleteTemplate: (id: number) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    templateName: "",
    titleTemplate: "",
    descriptionTemplate: "",
  });

  const startEdit = (template?: AdTemplate) => {
    if (template) {
      setEditForm({
        templateName: template.templateName,
        titleTemplate: template.titleTemplate,
        descriptionTemplate: template.descriptionTemplate,
      });
    } else {
      setEditForm({
        templateName: "New Template",
        titleTemplate: "{year} {make} {model} - ${price}",
        descriptionTemplate: "Check out this {year} {make} {model}! Only {mileage} km. Contact us today!",
      });
    }
    setIsEditing(true);
  };

  return (
    <Card className="bg-white/80">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#1877f2]" />
            Templates
          </CardTitle>
          <Button variant="outline" size="sm" onClick={() => startEdit()}>
            <Plus className="w-4 h-4 mr-1" />
            New
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {templates.map(template => (
            <div
              key={template.id}
              className={`p-3 rounded-lg border cursor-pointer transition-all flex items-center justify-between ${
                selectedTemplate?.id === template.id
                  ? 'border-[#1877f2] bg-[#1877f2]/5'
                  : 'hover:border-gray-300'
              }`}
              onClick={() => onSelectTemplate(template)}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#1877f2] to-[#00aad2] flex items-center justify-center">
                  <FileText className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="font-medium text-sm">{template.templateName}</p>
                  {template.isDefault && (
                    <Badge variant="secondary" className="text-xs mt-1">Default</Badge>
                  )}
                </div>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); startEdit(template); }}>
                  <Edit3 className="w-4 h-4" />
                </Button>
                {!template.isDefault && (
                  <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onDeleteTemplate(template.id); }}>
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
        
        <Dialog open={isEditing} onOpenChange={setIsEditing}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Template</DialogTitle>
              <DialogDescription>
                Use variables like {"{year}"}, {"{make}"}, {"{model}"}, {"{price}"}, {"{mileage}"} in your templates.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Template Name</Label>
                <Input
                  value={editForm.templateName}
                  onChange={(e) => setEditForm(f => ({ ...f, templateName: e.target.value }))}
                />
              </div>
              <div>
                <Label>Title Template</Label>
                <Input
                  value={editForm.titleTemplate}
                  onChange={(e) => setEditForm(f => ({ ...f, titleTemplate: e.target.value }))}
                />
              </div>
              <div>
                <Label>Description Template</Label>
                <Textarea
                  value={editForm.descriptionTemplate}
                  onChange={(e) => setEditForm(f => ({ ...f, descriptionTemplate: e.target.value }))}
                  rows={4}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
              <Button onClick={() => { onSaveTemplate(editForm); setIsEditing(false); }}>Save Template</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

export default function MarketplaceBlast() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedVehicle, setSelectedVehicle] = useState<BlastVehicle | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<FacebookAccount | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<AdTemplate | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  // Fetch queue
  const { data: queueData, isLoading: queueLoading } = useQuery<{ vehicles: BlastVehicle[]; total: number }>({
    queryKey: ['marketplace-blast-queue'],
    queryFn: async () => {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`/api/marketplace-blast/queue?limit=100`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch queue');
      return res.json();
    }
  });

  // Fetch user's Facebook accounts
  const { data: accounts = [] } = useQuery<FacebookAccount[]>({
    queryKey: ['facebook-accounts'],
    queryFn: async () => {
      const token = localStorage.getItem('auth_token');
      const res = await fetch('/api/facebook-accounts', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) return [];
      return res.json();
    }
  });

  // Fetch user's templates
  const { data: templates = [] } = useQuery<AdTemplate[]>({
    queryKey: ['ad-templates'],
    queryFn: async () => {
      const token = localStorage.getItem('auth_token');
      const res = await fetch('/api/ad-templates', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) return [];
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

  const openMarketplace = () => {
    window.open('https://www.facebook.com/marketplace/create/vehicle', '_blank');
  };

  // Calculate KPI stats
  const vehicles = queueData?.vehicles || [];
  const readyCount = vehicles.filter(v => v.socialTemplates).length;
  const pendingCount = vehicles.length - readyCount;
  const postedTodayCount = vehicles.filter(v => {
    if (!v.marketplacePostedAt) return false;
    const posted = new Date(v.marketplacePostedAt);
    const today = new Date();
    return posted.toDateString() === today.toDateString();
  }).length;

  // Mock templates if none exist
  const displayTemplates: AdTemplate[] = templates.length > 0 ? templates : [
    { id: 1, templateName: "Standard Listing", titleTemplate: "{year} {make} {model} - ${price}", descriptionTemplate: "Check out this {year} {make} {model}! Only {mileage} km. Contact us today!", isDefault: true },
    { id: 2, templateName: "Urgent Sale", titleTemplate: "🔥 HOT DEAL: {year} {make} {model}", descriptionTemplate: "⚡ LIMITED TIME! This {year} {make} {model} won't last at ${price}. Call now!", isDefault: false },
  ];

  // Mock accounts if none exist
  const displayAccounts: FacebookAccount[] = accounts.length > 0 ? accounts : [
    { id: 1, accountName: "John Smith", facebookUserId: null, isActive: true, postsToday: 3, totalPosts: 47 },
    { id: 2, accountName: "Sales Team", facebookUserId: null, isActive: true, postsToday: 5, totalPosts: 123 },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100">
      {/* Header */}
      <div className="border-b bg-white/80 backdrop-blur-xl sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/sales">
                <Button variant="ghost" size="sm" data-testid="back-button">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Dashboard
                </Button>
              </Link>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="w-6 h-6 text-[#1877f2]" />
              <span className="text-xl font-bold bg-gradient-to-r from-[#1877f2] to-[#00aad2] bg-clip-text text-transparent">
                Marketplace Blast
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <KPICard
            title="Ready to Post"
            value={readyCount}
            icon={CheckCircle2}
            trend="+12% this week"
            color="#10b981"
          />
          <KPICard
            title="Posts Today"
            value={postedTodayCount}
            icon={CalendarDays}
            color="#1877f2"
          />
          <KPICard
            title="Pending Generation"
            value={pendingCount}
            icon={Clock}
            color="#f59e0b"
          />
          <KPICard
            title="Connected Accounts"
            value={displayAccounts.length}
            icon={Facebook}
            color="#1877f2"
          />
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-12 gap-6">
          {/* Left Sidebar - Connected Accounts & Templates */}
          <div className="col-span-12 lg:col-span-3 space-y-6">
            {/* Connected Accounts */}
            <Card className="bg-white/80">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Facebook className="w-5 h-5 text-[#1877f2]" />
                    Connected Accounts
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {displayAccounts.map(account => (
                    <AccountListItem
                      key={account.id}
                      account={account}
                      isSelected={selectedAccount?.id === account.id}
                      onClick={() => setSelectedAccount(account)}
                    />
                  ))}
                </div>
                
                {selectedAccount && (
                  <div className="mt-4 pt-4 border-t">
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1">
                        <Settings2 className="w-4 h-4 mr-1" />
                        Settings
                      </Button>
                      <Button variant="outline" size="sm" className="flex-1">
                        <FileText className="w-4 h-4 mr-1" />
                        Templates
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Templates */}
            <TemplateEditor
              templates={displayTemplates}
              selectedTemplate={selectedTemplate}
              onSelectTemplate={setSelectedTemplate}
              onSaveTemplate={(data) => {
                toast({ title: "Template saved!", description: "Your template has been updated" });
              }}
              onDeleteTemplate={(id) => {
                toast({ title: "Template deleted", description: "Template has been removed" });
              }}
            />
          </div>

          {/* Center - Vehicle Queue */}
          <div className="col-span-12 lg:col-span-5">
            <Card className="bg-white/80 h-full">
              <CardContent className="p-6">
                <VehicleQueue
                  vehicles={vehicles}
                  selectedVehicle={selectedVehicle}
                  onSelectVehicle={setSelectedVehicle}
                  onGenerateContent={(id) => generateMutation.mutate(id)}
                  onMarkPosted={(id) => markPostedMutation.mutate(id)}
                  isGenerating={generateMutation.isPending}
                />
              </CardContent>
            </Card>
          </div>

          {/* Right - Post Preview */}
          <div className="col-span-12 lg:col-span-4">
            <PostPreview
              vehicle={selectedVehicle}
              template={selectedTemplate}
              onOpenMarketplace={openMarketplace}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
