import { useState, useMemo } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  TrendingUp,
  CalendarDays,
  Download,
  ImageIcon,
  FileText,
  ChevronDown,
  Plus,
  Settings
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

interface Template {
  id: string;
  name: string;
  titleTemplate: string;
  descriptionTemplate: string;
  isDefault?: boolean;
  isShared?: boolean;
  userId?: number;
}

interface DbTemplate {
  id: number;
  dealershipId: number;
  userId: number;
  templateName: string;
  titleTemplate: string;
  descriptionTemplate: string;
  isDefault: boolean;
  isShared: boolean;
  parentTemplateId: number | null;
  createdAt: string;
  updatedAt: string;
}

const DEFAULT_TEMPLATES: Template[] = [
  {
    id: "standard",
    name: "Standard Listing",
    titleTemplate: "{year} {make} {model} - ${price}",
    descriptionTemplate: "Check out this {year} {make} {model}! Only {mileage} km. Contact us today!",
    isDefault: true,
  },
  {
    id: "urgent",
    name: "Urgent Sale",
    titleTemplate: "🔥 HOT DEAL: {year} {make} {model}",
    descriptionTemplate: "⚡ LIMITED TIME! This {year} {make} {model} won't last at ${price}. Call now!",
    isDefault: true,
  },
  {
    id: "premium",
    name: "Premium Showcase",
    titleTemplate: "✨ Luxury {year} {make} {model} Available",
    descriptionTemplate: "Experience luxury with this stunning {year} {make} {model}. Premium features, exceptional value at ${price}.",
    isDefault: true,
  },
  {
    id: "ai",
    name: "AI Generated",
    titleTemplate: "",
    descriptionTemplate: "",
    isDefault: true,
  },
];

function CopyButton({ text, label = "Copy", size = "sm", variant = "outline" }: { text: string; label?: string; size?: "sm" | "default"; variant?: "outline" | "default" }) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
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
      variant={copied ? "default" : variant}
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

function VehicleImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  if (error || !src) {
    return (
      <div className={`bg-gray-100 flex items-center justify-center ${className}`}>
        <Car className="w-6 h-6 text-gray-400" />
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {loading && (
        <div className="absolute inset-0 bg-gray-100 flex items-center justify-center">
          <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
        </div>
      )}
      <img
        src={src}
        alt={alt}
        className={`w-full h-full object-cover ${loading ? 'opacity-0' : 'opacity-100'} transition-opacity`}
        onError={() => setError(true)}
        onLoad={() => setLoading(false)}
        referrerPolicy="no-referrer"
        crossOrigin="anonymous"
      />
    </div>
  );
}

function applyTemplate(template: Template, vehicle: BlastVehicle): { title: string; description: string } {
  const replacements: Record<string, string> = {
    '{year}': vehicle.year.toString(),
    '{make}': vehicle.make,
    '{model}': vehicle.model,
    '{trim}': vehicle.trim || '',
    '{price}': vehicle.price.toLocaleString(),
    '${price}': `$${vehicle.price.toLocaleString()}`,
    '{mileage}': vehicle.odometer.toLocaleString(),
    '{location}': vehicle.location || '',
  };

  let title = template.titleTemplate;
  let description = template.descriptionTemplate;

  for (const [key, value] of Object.entries(replacements)) {
    title = title.replace(new RegExp(key.replace(/[{}$]/g, '\\$&'), 'g'), value);
    description = description.replace(new RegExp(key.replace(/[{}$]/g, '\\$&'), 'g'), value);
  }

  return { title, description };
}

function VehicleAccordionItem({
  vehicle,
  templates = DEFAULT_TEMPLATES,
  onGenerateContent,
  onMarkPosted,
  isGenerating,
}: {
  vehicle: BlastVehicle;
  templates?: Template[];
  onGenerateContent: (vehicleId: number) => void;
  onMarkPosted: (vehicleId: number) => void;
  isGenerating: boolean;
}) {
  const { toast } = useToast();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(vehicle.socialTemplates ? "ai" : "standard");

  const safeTemplates = templates || DEFAULT_TEMPLATES;
  const selectedTemplate = safeTemplates.find(t => t.id === selectedTemplateId);
  
  const { title, description } = useMemo(() => {
    if (selectedTemplateId === "ai" && vehicle.socialTemplates) {
      return {
        title: vehicle.socialTemplates.marketplace.title,
        description: vehicle.socialTemplates.marketplace.description,
      };
    }
    if (selectedTemplate && selectedTemplateId !== "ai") {
      return applyTemplate(selectedTemplate, vehicle);
    }
    return {
      title: `${vehicle.year} ${vehicle.make} ${vehicle.model} - $${vehicle.price.toLocaleString()}`,
      description: `Check out this ${vehicle.year} ${vehicle.make} ${vehicle.model}! Only ${vehicle.odometer.toLocaleString()} km. Contact us today!`,
    };
  }, [selectedTemplateId, selectedTemplate, vehicle]);

  const downloadAllPhotos = async () => {
    if (!vehicle.images || vehicle.images.length === 0) {
      toast({ title: "No photos", description: "This vehicle has no photos to download", variant: "destructive" });
      return;
    }
    
    vehicle.images.slice(0, 10).forEach((url, index) => {
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      window.open(url, `_blank_${index}`);
    });
    
    toast({ 
      title: "Photos opened!", 
      description: `Opened ${Math.min(vehicle.images.length, 10)} photos in new tabs. Right-click to save each one.` 
    });
  };

  const openMarketplace = () => {
    window.open('https://www.facebook.com/marketplace/create/vehicle', '_blank');
  };

  return (
    <AccordionItem value={`vehicle-${vehicle.id}`} className="border rounded-lg mb-3 bg-white shadow-sm hover:shadow-md transition-shadow">
      <AccordionTrigger className="px-4 py-3 hover:no-underline [&[data-state=open]>div>.chevron]:rotate-180">
        <div className="flex items-center gap-4 w-full">
          <div className="w-16 h-12 rounded-lg overflow-hidden flex-shrink-0">
            <VehicleImage 
              src={vehicle.images?.[0] || ''} 
              alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
              className="w-full h-full"
            />
          </div>
          
          <div className="flex-1 text-left">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-900">
                {vehicle.year} {vehicle.make} {vehicle.model}
              </span>
              {vehicle.trim && (
                <span className="text-sm text-gray-500">{vehicle.trim}</span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1 text-sm">
              <span className="font-bold text-[#1877f2]">${vehicle.price.toLocaleString()}</span>
              <span className="text-gray-500">{vehicle.odometer.toLocaleString()} km</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-orange-50 text-orange-600 border-orange-200">
              <Clock className="w-3 h-3 mr-1" />
              {vehicle.daysInStock}d
            </Badge>
            {vehicle.socialTemplates && (
              <Badge className="bg-emerald-500">
                <Sparkles className="w-3 h-3 mr-1" />
                AI Ready
              </Badge>
            )}
            {vehicle.marketplacePostedAt && (
              <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200">
                <CheckCircle className="w-3 h-3 mr-1" />
                Posted
              </Badge>
            )}
          </div>
          
          <ChevronDown className="chevron w-5 h-5 text-gray-400 transition-transform duration-200" />
        </div>
      </AccordionTrigger>
      
      <AccordionContent className="px-4 pb-4">
        <div className="pt-4 border-t">
          <div className="grid grid-cols-12 gap-6">
            {/* Photos Section */}
            <div className="col-span-4">
              <div className="flex items-center justify-between mb-3">
                <Label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <ImageIcon className="w-4 h-4" />
                  Photos ({vehicle.images?.length || 0})
                </Label>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={downloadAllPhotos}
                  className="gap-2"
                  data-testid={`download-photos-${vehicle.id}`}
                >
                  <Download className="w-4 h-4" />
                  Open All Photos
                </Button>
              </div>
              
              <div className="grid grid-cols-4 gap-2">
                {vehicle.images?.slice(0, 8).map((img, idx) => (
                  <a
                    key={idx}
                    href={img}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="aspect-square rounded-lg overflow-hidden hover:ring-2 ring-[#1877f2] transition-all"
                  >
                    <VehicleImage 
                      src={img} 
                      alt={`Photo ${idx + 1}`}
                      className="w-full h-full"
                    />
                  </a>
                ))}
              </div>
              {vehicle.images && vehicle.images.length > 8 && (
                <p className="text-xs text-gray-500 mt-2 text-center">
                  +{vehicle.images.length - 8} more photos
                </p>
              )}
            </div>
            
            {/* Content Section */}
            <div className="col-span-8">
              <div className="flex items-center justify-between mb-3">
                <Label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Listing Content
                </Label>
                <div className="flex items-center gap-3">
                  <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                    <SelectTrigger className="w-48" data-testid={`template-select-${vehicle.id}`}>
                      <SelectValue placeholder="Select template" />
                    </SelectTrigger>
                    <SelectContent>
                      {safeTemplates.map(t => (
                        <SelectItem 
                          key={t.id} 
                          value={t.id}
                          disabled={t.id === "ai" && !vehicle.socialTemplates}
                        >
                          {t.name}
                          {t.id === "ai" && !vehicle.socialTemplates && " (Generate first)"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  {!vehicle.socialTemplates ? (
                    <Button
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); onGenerateContent(vehicle.id); }}
                      disabled={isGenerating}
                      className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                      data-testid={`generate-${vehicle.id}`}
                    >
                      {isGenerating ? (
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Sparkles className="w-4 h-4 mr-2" />
                      )}
                      Generate AI
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => { e.stopPropagation(); onGenerateContent(vehicle.id); }}
                      disabled={isGenerating}
                      data-testid={`regenerate-${vehicle.id}`}
                    >
                      <RefreshCw className={`w-4 h-4 mr-2 ${isGenerating ? 'animate-spin' : ''}`} />
                      Regenerate
                    </Button>
                  )}
                </div>
              </div>
              
              <div className="space-y-4">
                {/* Title */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label className="text-xs font-medium text-gray-500 uppercase">Title</Label>
                    <CopyButton text={title} label="Copy" />
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg border text-sm font-medium">
                    {title}
                  </div>
                </div>
                
                {/* Description */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label className="text-xs font-medium text-gray-500 uppercase">Description</Label>
                    <CopyButton text={description} label="Copy" />
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg border text-sm max-h-32 overflow-auto whitespace-pre-wrap">
                    {description}
                  </div>
                </div>
                
                {/* Actions */}
                <div className="flex items-center justify-between pt-2">
                  <CopyButton 
                    text={`${title}\n\n${description}`} 
                    label="Copy All" 
                    size="default"
                    variant="default"
                  />
                  
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={openMarketplace}
                      className="gap-2"
                      data-testid={`open-marketplace-${vehicle.id}`}
                    >
                      <Facebook className="w-4 h-4" />
                      Open Marketplace
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                    <Button
                      onClick={(e) => { e.stopPropagation(); onMarkPosted(vehicle.id); }}
                      className="bg-emerald-600 hover:bg-emerald-700 gap-2"
                      data-testid={`mark-posted-${vehicle.id}`}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Mark as Posted
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

export default function MarketplaceBlast() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedAccount, setSelectedAccount] = useState<FacebookAccount | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedVehicles, setExpandedVehicles] = useState<string[]>([]);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateTitle, setNewTemplateTitle] = useState("{year} {make} {model} - ${price}");
  const [newTemplateDescription, setNewTemplateDescription] = useState("");

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

  // Fetch templates from database (manager-created + merge with defaults)
  const { data: dbTemplates = [] } = useQuery<DbTemplate[]>({
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

  // Merge database templates with defaults (shared first, then personal, then built-in)
  const allTemplates: Template[] = useMemo(() => {
    const sharedTemplates: Template[] = dbTemplates
      .filter(t => t.isShared)
      .map(t => ({
        id: `db-${t.id}`,
        name: `📋 ${t.templateName}`,
        titleTemplate: t.titleTemplate,
        descriptionTemplate: t.descriptionTemplate,
        isDefault: false,
        isShared: true,
        userId: t.userId,
      }));
    const personalTemplates: Template[] = dbTemplates
      .filter(t => !t.isShared)
      .map(t => ({
        id: `db-${t.id}`,
        name: `👤 ${t.templateName}`,
        titleTemplate: t.titleTemplate,
        descriptionTemplate: t.descriptionTemplate,
        isDefault: false,
        isShared: false,
        userId: t.userId,
      }));
    return [...sharedTemplates, ...personalTemplates, ...DEFAULT_TEMPLATES];
  }, [dbTemplates]);

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketplace-blast-queue'] });
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
      toast({ title: "Marked as posted!", description: "Vehicle removed from queue" });
    }
  });

  // Create template mutation
  const createTemplateMutation = useMutation({
    mutationFn: async (templateData: { templateName: string; titleTemplate: string; descriptionTemplate: string }) => {
      const token = localStorage.getItem('auth_token');
      const res = await fetch('/api/ad-templates', {
        method: 'POST',
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(templateData)
      });
      if (!res.ok) throw new Error('Failed to create template');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ad-templates'] });
      setShowTemplateDialog(false);
      setNewTemplateName("");
      setNewTemplateTitle("{year} {make} {model} - ${price}");
      setNewTemplateDescription("");
      toast({ title: "Template created!", description: "Your new template is now available for all listings" });
    },
    onError: () => {
      toast({ title: "Failed to create template", description: "Please try again", variant: "destructive" });
    }
  });

  const handleCreateTemplate = () => {
    if (!newTemplateName.trim() || !newTemplateTitle.trim() || !newTemplateDescription.trim()) {
      toast({ title: "Missing fields", description: "Please fill in all template fields", variant: "destructive" });
      return;
    }
    createTemplateMutation.mutate({
      templateName: newTemplateName,
      titleTemplate: newTemplateTitle,
      descriptionTemplate: newTemplateDescription
    });
  };

  // Filter vehicles by search
  const vehicles = queueData?.vehicles || [];
  const filteredVehicles = useMemo(() => {
    if (!searchQuery) return vehicles;
    const search = searchQuery.toLowerCase();
    return vehicles.filter(v => 
      v.make.toLowerCase().includes(search) ||
      v.model.toLowerCase().includes(search) ||
      v.year.toString().includes(search) ||
      v.stockNumber?.toLowerCase().includes(search)
    );
  }, [vehicles, searchQuery]);

  // Calculate KPI stats
  const readyCount = vehicles.filter(v => v.socialTemplates).length;
  const pendingCount = vehicles.length - readyCount;
  const postedTodayCount = vehicles.filter(v => {
    if (!v.marketplacePostedAt) return false;
    const posted = new Date(v.marketplacePostedAt);
    const today = new Date();
    return posted.toDateString() === today.toDateString();
  }).length;

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
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Zap className="w-6 h-6 text-[#1877f2]" />
                <span className="text-xl font-bold bg-gradient-to-r from-[#1877f2] to-[#00aad2] bg-clip-text text-transparent">
                  Marketplace Blast
                </span>
              </div>
              <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2" data-testid="create-template-button">
                    <Plus className="w-4 h-4" />
                    New Template
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Create New Template</DialogTitle>
                    <DialogDescription>
                      Create a reusable template for your Marketplace listings. Use placeholders like {"{year}"}, {"{make}"}, {"{model}"}, {"${price}"}, {"{mileage}"}, {"{location}"}.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="template-name">Template Name</Label>
                      <Input 
                        id="template-name"
                        placeholder="e.g., Luxury Sale"
                        value={newTemplateName}
                        onChange={(e) => setNewTemplateName(e.target.value)}
                        data-testid="input-template-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="template-title">Title Template</Label>
                      <Input 
                        id="template-title"
                        placeholder="{year} {make} {model} - ${price}"
                        value={newTemplateTitle}
                        onChange={(e) => setNewTemplateTitle(e.target.value)}
                        data-testid="input-template-title"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="template-description">Description Template</Label>
                      <Textarea 
                        id="template-description"
                        placeholder="Check out this {year} {make} {model}! Only {mileage} km..."
                        className="min-h-[120px]"
                        value={newTemplateDescription}
                        onChange={(e) => setNewTemplateDescription(e.target.value)}
                        data-testid="input-template-description"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowTemplateDialog(false)}>
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleCreateTemplate}
                      disabled={createTemplateMutation.isPending}
                      className="gap-2"
                      data-testid="save-template-button"
                    >
                      {createTemplateMutation.isPending ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Plus className="w-4 h-4" />
                      )}
                      Create Template
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
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
          {/* Left Sidebar - Connected Accounts */}
          <div className="col-span-12 lg:col-span-3">
            <Card className="bg-white/80">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Facebook className="w-5 h-5 text-[#1877f2]" />
                  Connected Accounts
                </CardTitle>
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
              </CardContent>
            </Card>
          </div>

          {/* Main Content - Vehicle List */}
          <div className="col-span-12 lg:col-span-9">
            <Card className="bg-white/80">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Car className="w-5 h-5 text-[#1877f2]" />
                    Vehicle Queue ({filteredVehicles.length})
                  </CardTitle>
                  <div className="flex items-center gap-3">
                    <Input
                      placeholder="Search vehicles..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-64"
                      data-testid="search-vehicles"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => queryClient.invalidateQueries({ queryKey: ['marketplace-blast-queue'] })}
                    >
                      <RefreshCw className={`w-4 h-4 ${queueLoading ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {queueLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3, 4].map(i => (
                      <div key={i} className="h-20 bg-gray-100 rounded-lg animate-pulse" />
                    ))}
                  </div>
                ) : filteredVehicles.length === 0 ? (
                  <div className="text-center py-12">
                    <Car className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                    <h3 className="text-lg font-medium text-gray-600">No vehicles in queue</h3>
                    <p className="text-sm text-gray-400 mt-1">All vehicles have been posted or are on cooldown</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[calc(100vh-380px)]">
                    <Accordion 
                      type="multiple" 
                      value={expandedVehicles}
                      onValueChange={setExpandedVehicles}
                      className="space-y-2"
                    >
                      {filteredVehicles.map(vehicle => (
                        <VehicleAccordionItem
                          key={vehicle.id}
                          vehicle={vehicle}
                          templates={allTemplates}
                          onGenerateContent={(id) => generateMutation.mutate(id)}
                          onMarkPosted={(id) => markPostedMutation.mutate(id)}
                          isGenerating={generateMutation.isPending}
                        />
                      ))}
                    </Accordion>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
