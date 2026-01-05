import { useState, useMemo, useEffect } from "react";
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
import { Switch } from "@/components/ui/switch";
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
  Settings,
  Pencil,
  Trash2,
  Share2,
  Users,
  AlertTriangle,
  ShieldCheck
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
  activeListingStatus?: string | null;
  activeListingByName?: string | null;
  activeListingById?: number | null;
  activeListingId?: number | null;
  activeListingBundleId?: number | null;
}

interface ListingBundle {
  id: number;
  vehicleId: number;
  rooftopId: number | null;
  title: string | null;
  description: string | null;
  price: number | null;
  features: string[];
  hashtags: string[];
  imageUrls: string[] | null;
  status: string;
  createdAt: string;
  updatedAt: string;
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
    titleTemplate: "HOT DEAL: {year} {make} {model}",
    descriptionTemplate: "Limited time pricing on this {year} {make} {model} at ${price}. Contact us today!",
    isDefault: true,
  },
  {
    id: "premium",
    name: "Premium Showcase",
    titleTemplate: "Luxury {year} {make} {model} Available",
    descriptionTemplate: "Experience premium features in this {year} {make} {model}. Exceptional value at ${price}.",
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

const DEFAULT_COMPLIANCE_FOOTER =
  "Availability and price subject to change. Taxes and fees extra. Confirm details with our team.";

type ComplianceIssue = {
  id: string;
  level: "critical" | "warning";
  message: string;
  suggestion?: string;
};

type QualitySignal = {
  id: string;
  label: string;
  status: "good" | "warn" | "bad";
  detail: string;
};

const COMPLIANCE_RULES: Array<{
  id: string;
  level: "critical" | "warning";
  pattern: RegExp;
  message: string;
  suggestion?: string;
}> = [
  {
    id: "guarantee",
    level: "critical",
    pattern: /\b(guarantee|guaranteed|100%|sure thing)\b/i,
    message: "Avoid guarantees or absolute promises.",
    suggestion: "Use softer language and invite confirmation.",
  },
  {
    id: "credit-promise",
    level: "critical",
    pattern: /\b(no credit check|bad credit|guaranteed financing|instant approval)\b/i,
    message: "Avoid credit or financing promises.",
    suggestion: "Offer to review options after a quick chat.",
  },
  {
    id: "availability-promise",
    level: "warning",
    pattern: /\b(in stock|available now|available today|on the lot|won't last)\b/i,
    message: "Avoid promising availability.",
    suggestion: "Confirm availability with the buyer.",
  },
  {
    id: "price-final",
    level: "warning",
    pattern: /\b(price is firm|no negotiation|final price)\b/i,
    message: "Avoid locking price terms.",
    suggestion: "Use a flexible pricing statement.",
  },
];

function lintMarketplaceCopy(params: {
  title: string;
  description: string;
  includeComplianceFooter: boolean;
  includePageDmCta: boolean;
  pageDmLink: string;
}): ComplianceIssue[] {
  const issues: ComplianceIssue[] = [];
  const combined = `${params.title}\n${params.description}`;

  for (const rule of COMPLIANCE_RULES) {
    if (rule.pattern.test(combined)) {
      issues.push({
        id: rule.id,
        level: rule.level,
        message: rule.message,
        suggestion: rule.suggestion,
      });
    }
  }

  if (!/subject to change|price and availability/i.test(params.description)) {
    issues.push({
      id: "missing-disclaimer",
      level: "warning",
      message: "Add a price and availability disclaimer.",
      suggestion: params.includeComplianceFooter
        ? "Include a short 'subject to change' footer."
        : "Enable the compliance footer or add a disclaimer manually.",
    });
  }

  if (params.includePageDmCta && !params.pageDmLink.trim()) {
    issues.push({
      id: "missing-dm-link",
      level: "warning",
      message: "Page DM link is missing.",
      suggestion: "Add a Page DM link to route buyers to Messenger.",
    });
  }

  return issues;
}

function buildQualitySignals(title: string, description: string, photoCount: number): QualitySignal[] {
  const titleLength = title.trim().length;
  const descriptionLength = description.trim().length;

  const photoStatus: QualitySignal["status"] =
    photoCount >= 8 ? "good" : photoCount >= 4 ? "warn" : "bad";
  const titleStatus: QualitySignal["status"] =
    titleLength >= 18 && titleLength <= 70 ? "good" : titleLength >= 12 && titleLength <= 90 ? "warn" : "bad";
  const descriptionStatus: QualitySignal["status"] =
    descriptionLength >= 120 && descriptionLength <= 1200
      ? "good"
      : descriptionLength >= 60 && descriptionLength <= 1800
      ? "warn"
      : "bad";

  return [
    {
      id: "photos",
      label: `Photos: ${photoCount}`,
      status: photoStatus,
      detail: "Aim for 8+ photos to maximize engagement.",
    },
    {
      id: "title",
      label: `Title: ${titleLength} chars`,
      status: titleStatus,
      detail: "Keep titles concise and descriptive.",
    },
    {
      id: "description",
      label: `Description: ${descriptionLength} chars`,
      status: descriptionStatus,
      detail: "Give enough detail without overwhelming.",
    },
  ];
}

function findTemplateByKeywords(templates: Template[], keywords: string[]): Template | undefined {
  const loweredKeywords = keywords.map((keyword) => keyword.toLowerCase());
  return templates.find((template) =>
    loweredKeywords.some((keyword) => template.name.toLowerCase().includes(keyword))
  );
}

function getDefaultTemplateId(templates: Template[]): string {
  return templates.find((template) => template.isDefault)?.id || templates[0]?.id || "standard";
}

function getRecommendedTemplateId(vehicle: BlastVehicle, templates: Template[]): string {
  const defaultId = getDefaultTemplateId(templates);

  if (vehicle.socialTemplates && templates.some((template) => template.id === "ai")) {
    return "ai";
  }

  if (vehicle.daysInStock >= 60) {
    return findTemplateByKeywords(templates, ["urgent", "clearance", "aged", "sale"])?.id || defaultId;
  }

  if (vehicle.price >= 45000) {
    return findTemplateByKeywords(templates, ["premium", "luxury", "showcase"])?.id || defaultId;
  }

  if (vehicle.price <= 15000) {
    return findTemplateByKeywords(templates, ["value", "budget", "affordable", "special"])?.id || defaultId;
  }

  return defaultId;
}

function getQualityBadgeVariant(status: QualitySignal["status"]): "default" | "secondary" | "destructive" {
  if (status === "good") return "default";
  if (status === "warn") return "secondary";
  return "destructive";
}

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
  pageDmLink,
  includePageDmCta,
  includeComplianceFooter,
  complianceFooter,
  autoTemplate,
  isGenerating,
  isExpanded,
}: {
  vehicle: BlastVehicle;
  templates?: Template[];
  onGenerateContent: (vehicleId: number) => void;
  onMarkPosted: (vehicleId: number, bundleId?: number | null) => void;
  pageDmLink: string;
  includePageDmCta: boolean;
  includeComplianceFooter: boolean;
  complianceFooter: string;
  autoTemplate: boolean;
  isGenerating: boolean;
  isExpanded: boolean;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: bundleData, isFetching: bundleLoading } = useQuery<{ bundle: ListingBundle | null }>({
    queryKey: ['listing-bundle', vehicle.id],
    enabled: isExpanded,
    queryFn: async () => {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`/api/listing-bundles/vehicle/${vehicle.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch bundle');
      return res.json();
    }
  });
  const bundle = bundleData?.bundle || null;
  const isBundleReady = !!bundle && bundle.status === "ready";

  const startPostingMutation = useMutation({
    mutationFn: async () => {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`/api/marketplace-blast/start-posting/${vehicle.id}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ bundleId: bundle?.id || null })
      });
      if (!res.ok) {
        throw new Error('Failed to start posting');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketplace-blast-queue'] });
      toast({ title: "Posting lock active", description: "This VIN is locked to you while you post." });
    },
    onError: () => {
      toast({ title: "Lock failed", description: "Unable to lock this VIN for posting.", variant: "destructive" });
    }
  });

  const safeTemplates = templates || DEFAULT_TEMPLATES;
  const recommendedTemplateId = useMemo(
    () => getRecommendedTemplateId(vehicle, safeTemplates),
    [vehicle, safeTemplates]
  );
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(recommendedTemplateId);
  const selectedTemplate = safeTemplates.find(t => t.id === selectedTemplateId);

  useEffect(() => {
    if (autoTemplate) {
      setSelectedTemplateId(recommendedTemplateId);
    }
  }, [autoTemplate, recommendedTemplateId]);

  const generateBundleMutation = useMutation({
    mutationFn: async () => {
      const token = localStorage.getItem('auth_token');
      const isAiTemplate = selectedTemplateId === "ai";
      const templateId = selectedTemplateId.startsWith("db-")
        ? parseInt(selectedTemplateId.replace("db-", ""), 10)
        : null;
      const normalizedTemplateId = Number.isNaN(templateId ?? NaN) ? null : templateId;

      const body = {
        templateId: normalizedTemplateId,
        useAi: isAiTemplate,
        titleTemplate: !isAiTemplate && !templateId && selectedTemplate ? selectedTemplate.titleTemplate : null,
        descriptionTemplate: !isAiTemplate && !templateId && selectedTemplate ? selectedTemplate.descriptionTemplate : null,
        pageDmLink,
        includePageDmCta,
        includeComplianceFooter,
        complianceFooter,
      };

      const res = await fetch(`/api/listing-bundles/vehicle/${vehicle.id}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        throw new Error('Failed to build bundle');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['listing-bundle', vehicle.id] });
      toast({ title: "Bundle ready", description: "Listing bundle generated and saved." });
    },
    onError: () => {
      toast({ title: "Bundle failed", description: "Could not generate listing bundle.", variant: "destructive" });
    }
  });
  
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

  const pageDmCta = includePageDmCta && pageDmLink?.trim()
    ? `Fastest response: message our dealership page here: ${pageDmLink.trim()}\nInclude stock # or VIN.`
    : "";
  const complianceFooterText = includeComplianceFooter ? complianceFooter.trim() : "";
  const descriptionWithCta = bundle?.description?.trim()
    ? bundle.description
    : [description, pageDmCta, complianceFooterText].filter(Boolean).join("\n\n");
  const activeTitle = bundle?.title?.trim() ? bundle.title : title;
  const activeDescription = descriptionWithCta;

  const complianceIssues = useMemo(
    () =>
      lintMarketplaceCopy({
        title: activeTitle,
        description: activeDescription,
        includeComplianceFooter,
        includePageDmCta,
        pageDmLink,
      }),
    [activeTitle, activeDescription, includeComplianceFooter, includePageDmCta, pageDmLink]
  );

  const qualitySignals = useMemo(
    () => buildQualitySignals(activeTitle, activeDescription, vehicle.images?.length || 0),
    [activeTitle, activeDescription, vehicle.images?.length]
  );

  const isLocked = vehicle.activeListingStatus === "posting" || vehicle.activeListingStatus === "posted";
  const lockLabel = vehicle.activeListingStatus === "posting"
    ? `Locked${vehicle.activeListingByName ? ` by ${vehicle.activeListingByName}` : ""}`
    : vehicle.activeListingStatus === "posted"
    ? "Posted"
    : null;

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

  const downloadPhotoZip = async () => {
    const token = localStorage.getItem('auth_token');
    if (!vehicle.images || vehicle.images.length === 0) {
      toast({ title: "No photos", description: "This vehicle has no photos to download", variant: "destructive" });
      return;
    }
    try {
      const res = await fetch(`/api/marketplace-blast/photos/${vehicle.id}?format=zip&limit=10`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        throw new Error('Failed to download zip');
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      const safeStock = vehicle.stockNumber ? `-${vehicle.stockNumber.replace(/[^a-zA-Z0-9-_]+/g, "-")}` : '';
      link.href = url;
      link.download = `${vehicle.year}-${vehicle.make}-${vehicle.model}${safeStock}.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast({ title: "Download failed", description: "Unable to download photo zip.", variant: "destructive" });
    }
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
            {lockLabel && (
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                <ShieldCheck className="w-3 h-3 mr-1" />
                {lockLabel}
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
                <div className="flex items-center gap-2">
                  <Button 
                    size="sm" 
                    onClick={downloadPhotoZip}
                    className="gap-2"
                    data-testid={`download-photos-${vehicle.id}`}
                  >
                    <Download className="w-4 h-4" />
                    Download ZIP
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={downloadAllPhotos}
                    className="gap-2"
                  >
                    <ImageIcon className="w-4 h-4" />
                    Open All
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-end mb-3">
                <CopyButton
                  text={(vehicle.images || []).slice(0, 10).join("\n")}
                  label="Copy URLs"
                  size="sm"
                  variant="outline"
                />
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
                  <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId} disabled={autoTemplate}>
                    <SelectTrigger className="w-48" data-testid={`template-select-${vehicle.id}`}>
                      <SelectValue placeholder="Select template" />
                    </SelectTrigger>
                    <SelectContent>
                      {safeTemplates.map(t => (
                        <SelectItem 
                          key={t.id} 
                          value={t.id}
                        >
                          {t.name}
                          {t.id === recommendedTemplateId && " (Recommended)"}
                          {t.id === "ai" && !vehicle.socialTemplates && " (Bundle will generate)"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Badge variant={autoTemplate ? "default" : "secondary"}>
                    {autoTemplate ? "Smart Template" : "Manual Template"}
                  </Badge>
                  {!autoTemplate && recommendedTemplateId !== selectedTemplateId && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedTemplateId(recommendedTemplateId);
                      }}
                    >
                      Use recommended
                    </Button>
                  )}

                  {isBundleReady && (
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Bundle Ready
                    </Badge>
                  )}
                  <Button
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      generateBundleMutation.mutate();
                    }}
                    disabled={generateBundleMutation.isPending}
                    className="bg-gradient-to-r from-slate-900 to-slate-700 hover:from-slate-800 hover:to-slate-700"
                    data-testid={`bundle-${vehicle.id}`}
                  >
                    {generateBundleMutation.isPending ? (
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4 mr-2" />
                    )}
                    {isBundleReady ? "Regenerate Bundle" : "Build Bundle"}
                  </Button>

                  {selectedTemplateId === "ai" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => { e.stopPropagation(); onGenerateContent(vehicle.id); }}
                      disabled={isGenerating}
                      data-testid={`generate-ai-${vehicle.id}`}
                    >
                      <RefreshCw className={`w-4 h-4 mr-2 ${isGenerating ? 'animate-spin' : ''}`} />
                      {vehicle.socialTemplates ? "Refresh AI Template" : "Generate AI Template"}
                    </Button>
                  )}
                </div>
              </div>
              
              <div className="space-y-4">
                {/* Title */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label className="text-xs font-medium text-gray-500 uppercase">Title</Label>
                    <CopyButton text={activeTitle} label="Copy" />
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg border text-sm font-medium">
                    {activeTitle}
                  </div>
                </div>
                
                {/* Description */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label className="text-xs font-medium text-gray-500 uppercase">Description</Label>
                    <CopyButton text={activeDescription} label="Copy" />
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg border text-sm max-h-32 overflow-auto whitespace-pre-wrap">
                    {activeDescription}
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-semibold text-slate-700">Features</div>
                      <CopyButton
                        text={(bundle?.features || []).join("\n")}
                        label="Copy"
                        size="sm"
                        variant="outline"
                      />
                    </div>
                    <div className="mt-2 text-xs text-slate-600 space-y-1">
                      {bundleLoading ? (
                        <span className="text-slate-400">Loading bundle...</span>
                      ) : bundle?.features?.length ? (
                        bundle.features.map((feature, index) => (
                          <div key={`${vehicle.id}-feature-${index}`}>{feature}</div>
                        ))
                      ) : (
                        <span className="text-slate-400">Generate a bundle to populate features.</span>
                      )}
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-semibold text-slate-700">Hashtags</div>
                      <CopyButton
                        text={(bundle?.hashtags || []).join(" ")}
                        label="Copy"
                        size="sm"
                        variant="outline"
                      />
                    </div>
                    <div className="mt-2 text-xs text-slate-600 whitespace-pre-wrap">
                      {bundleLoading ? (
                        <span className="text-slate-400">Loading bundle...</span>
                      ) : bundle?.hashtags?.length ? (
                        bundle.hashtags.join(" ")
                      ) : (
                        <span className="text-slate-400">Generate a bundle to populate hashtags.</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs font-semibold text-slate-700 flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-slate-600" />
                      Quality Signals
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {qualitySignals.map((signal) => (
                        <Badge
                          key={signal.id}
                          variant={getQualityBadgeVariant(signal.status)}
                          title={signal.detail}
                        >
                          {signal.label}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div
                    className={`rounded-lg border p-3 ${
                      complianceIssues.length > 0
                        ? "border-amber-200 bg-amber-50"
                        : "border-emerald-200 bg-emerald-50"
                    }`}
                  >
                    <div className="text-xs font-semibold flex items-center gap-2">
                      {complianceIssues.length > 0 ? (
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                      ) : (
                        <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      )}
                      <span className={complianceIssues.length > 0 ? "text-amber-700" : "text-emerald-700"}>
                        Compliance Checks
                      </span>
                    </div>
                    {complianceIssues.length === 0 ? (
                      <p className="text-xs text-emerald-700 mt-2">No compliance issues found.</p>
                    ) : (
                      <div className="mt-2 space-y-2">
                        {complianceIssues.map((issue) => (
                          <div key={issue.id} className="text-xs text-amber-700">
                            <div className="font-medium">{issue.message}</div>
                            {issue.suggestion && (
                              <div className="text-amber-600">{issue.suggestion}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Actions */}
                <div className="flex items-center justify-between pt-2">
                  <CopyButton 
                    text={`${activeTitle}\n\n${activeDescription}`} 
                    label="Copy All" 
                    size="default"
                    variant="default"
                  />
                  
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        startPostingMutation.mutate();
                      }}
                      disabled={isLocked || startPostingMutation.isPending}
                      className="gap-2"
                      data-testid={`start-posting-${vehicle.id}`}
                    >
                      {startPostingMutation.isPending ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <ShieldCheck className="w-4 h-4" />
                      )}
                      {isLocked ? "Posting Locked" : "Start Posting"}
                    </Button>
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
                      onClick={(e) => { e.stopPropagation(); onMarkPosted(vehicle.id, bundle?.id ?? vehicle.activeListingBundleId ?? null); }}
                      disabled={vehicle.activeListingStatus === "posted"}
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
  const [showTemplateManager, setShowTemplateManager] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<DbTemplate | null>(null);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateTitle, setNewTemplateTitle] = useState("{year} {make} {model} - ${price}");
  const [newTemplateDescription, setNewTemplateDescription] = useState("");
  const [pageDmLink, setPageDmLink] = useState("");
  const [selectedPageId, setSelectedPageId] = useState("");
  const [includePageDmCta, setIncludePageDmCta] = useState(true);
  const [includeComplianceFooter, setIncludeComplianceFooter] = useState(true);
  const [complianceFooter, setComplianceFooter] = useState(DEFAULT_COMPLIANCE_FOOTER);
  const [autoTemplate, setAutoTemplate] = useState(true);
  const [autoPrepUseAi, setAutoPrepUseAi] = useState(true);
  const [showMarkPostedDialog, setShowMarkPostedDialog] = useState(false);
  const [markPostedVehicleId, setMarkPostedVehicleId] = useState<number | null>(null);
  const [markPostedBundleId, setMarkPostedBundleId] = useState<number | null>(null);
  const [markPostedUrl, setMarkPostedUrl] = useState("");
  const [copilotMessage, setCopilotMessage] = useState("");
  const [copilotVehicleId, setCopilotVehicleId] = useState<string>("none");
  const [copilotReply, setCopilotReply] = useState("");
  const [copilotIntent, setCopilotIntent] = useState<string | null>(null);

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

  const { data: connectedPages = [] } = useQuery<any[]>({
    queryKey: ['connected-pages'],
    queryFn: async () => {
      const token = localStorage.getItem('auth_token');
      const res = await fetch('/api/facebook/connected-pages', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) return [];
      return res.json();
    }
  });

  const { data: dealershipSettings } = useQuery<{ pageDmLink?: string | null }>({
    queryKey: ['dealership-settings'],
    queryFn: async () => {
      const token = localStorage.getItem('auth_token');
      const res = await fetch('/api/dealership/settings', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) return { pageDmLink: null };
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

  const autoPrepMutation = useMutation({
    mutationFn: async () => {
      const token = localStorage.getItem('auth_token');
      const res = await fetch('/api/listing-bundles/auto-prep', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          limit: 10,
          useAi: autoPrepUseAi,
          includePageDmCta,
          includeComplianceFooter,
          complianceFooter,
          pageDmLink
        })
      });
      if (!res.ok) throw new Error('Failed to auto-prep');
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['listing-bundle'] });
      toast({
        title: "Auto-prep complete",
        description: `Bundles updated: ${data?.updated || 0}, created: ${data?.created || 0}`
      });
    },
    onError: () => {
      toast({ title: "Auto-prep failed", description: "Unable to generate bundles.", variant: "destructive" });
    }
  });

  const prepAndLockMutation = useMutation({
    mutationFn: async () => {
      const token = localStorage.getItem('auth_token');
      const prepRes = await fetch('/api/listing-bundles/auto-prep', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          limit: 10,
          useAi: autoPrepUseAi,
          includePageDmCta,
          includeComplianceFooter,
          complianceFooter,
          pageDmLink
        })
      });
      if (!prepRes.ok) throw new Error('Failed to auto-prep');
      const prepData = await prepRes.json();

      const candidates = (queueData?.vehicles || [])
        .filter(vehicle => vehicle.activeListingStatus !== "posting" && vehicle.activeListingStatus !== "posted")
        .slice(0, 10);
      const lockResults: Array<{ vehicleId: number; status: string; error?: string }> = [];

      for (const vehicle of candidates) {
        let bundleId: number | null = null;
        try {
          const bundleRes = await fetch(`/api/listing-bundles/vehicle/${vehicle.id}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (bundleRes.ok) {
            const bundleJson = await bundleRes.json();
            bundleId = bundleJson?.bundle?.id ?? null;
          }
        } catch {
          bundleId = null;
        }

        const lockRes = await fetch(`/api/marketplace-blast/start-posting/${vehicle.id}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ bundleId })
        });

        if (lockRes.ok) {
          lockResults.push({ vehicleId: vehicle.id, status: "locked" });
        } else {
          let errorMessage = "Unable to lock";
          try {
            const errorJson = await lockRes.json();
            errorMessage = errorJson?.error || errorMessage;
          } catch {
            // ignore
          }
          lockResults.push({ vehicleId: vehicle.id, status: "skipped", error: errorMessage });
        }
      }

      return { prepData, lockResults };
    },
    onSuccess: (data) => {
      const locked = data.lockResults.filter(result => result.status === "locked").length;
      const skipped = data.lockResults.length - locked;
      queryClient.invalidateQueries({ queryKey: ['marketplace-blast-queue'] });
      queryClient.invalidateQueries({ queryKey: ['listing-bundle'] });
      toast({
        title: "Auto-prep + lock complete",
        description: `Locked ${locked} vehicle(s), skipped ${skipped}.`
      });
    },
    onError: () => {
      toast({ title: "Auto-prep + lock failed", description: "Unable to prep and lock vehicles.", variant: "destructive" });
    }
  });

  const copilotMutation = useMutation({
    mutationFn: async () => {
      const token = localStorage.getItem('auth_token');
      const vehicleId = copilotVehicleId !== "none" ? parseInt(copilotVehicleId, 10) : null;
      const res = await fetch('/api/marketplace-blast/suggest-reply', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: copilotMessage.trim(),
          vehicleId: Number.isNaN(vehicleId || NaN) ? null : vehicleId
        })
      });
      if (!res.ok) throw new Error('Failed to generate reply');
      return res.json();
    },
    onSuccess: (data) => {
      setCopilotReply(data?.reply || "");
      setCopilotIntent(data?.intent || null);
    },
    onError: () => {
      toast({ title: "Copilot failed", description: "Unable to suggest a reply.", variant: "destructive" });
    }
  });

  // Mark as posted mutation
  const markPostedMutation = useMutation({
    mutationFn: async ({ vehicleId, listingUrl, bundleId }: { vehicleId: number; listingUrl: string; bundleId?: number | null }) => {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`/api/marketplace-blast/mark-posted/${vehicleId}`, {
        method: 'POST',
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ listingUrl, bundleId })
      });
      if (!res.ok) throw new Error('Failed to mark as posted');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketplace-blast-queue'] });
      toast({ title: "Marked as posted!", description: "Vehicle removed from queue" });
      setMarkPostedVehicleId(null);
      setMarkPostedBundleId(null);
      setMarkPostedUrl("");
      setShowMarkPostedDialog(false);
    },
    onError: () => {
      toast({ title: "Mark posted failed", description: "Please check the URL and try again.", variant: "destructive" });
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

  const updateTemplateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: { templateName: string; titleTemplate: string; descriptionTemplate: string; isShared?: boolean } }) => {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`/api/ad-templates/${id}`, {
        method: 'PATCH',
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to update template');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ad-templates'] });
      setEditingTemplate(null);
      toast({ title: "Template updated!", description: "Your changes have been saved" });
    },
    onError: () => {
      toast({ title: "Failed to update template", description: "Please try again", variant: "destructive" });
    }
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: number) => {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`/api/ad-templates/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to delete template');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ad-templates'] });
      toast({ title: "Template deleted!", description: "Template has been removed" });
    },
    onError: () => {
      toast({ title: "Failed to delete template", description: "Please try again", variant: "destructive" });
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

  const markPostedVehicle = vehicles.find(v => v.id === markPostedVehicleId);

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

  useEffect(() => {
    if (!selectedPageId && connectedPages.length > 0) {
      setSelectedPageId(connectedPages[0].pageId);
      setPageDmLink(connectedPages[0].pageDmLink || dealershipSettings?.pageDmLink || "");
    }
  }, [connectedPages, selectedPageId, dealershipSettings]);

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
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-2" 
                onClick={() => setShowTemplateManager(true)}
                data-testid="manage-templates-button"
              >
                <Settings className="w-4 h-4" />
                Manage Templates
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Template Manager Dialog */}
      <Dialog open={showTemplateManager} onOpenChange={setShowTemplateManager}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Template Manager
            </DialogTitle>
            <DialogDescription>
              View and manage your Marketplace listing templates. Shared templates are visible to your team.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {dbTemplates.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No custom templates yet</p>
                <p className="text-sm">Create your first template using the "New Template" button</p>
              </div>
            ) : (
              <div className="space-y-3">
                {dbTemplates.map((template) => (
                  <Card key={template.id} data-testid={`template-card-${template.id}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium">{template.templateName}</span>
                            {template.isShared && (
                              <Badge variant="secondary" className="text-xs">
                                <Users className="w-3 h-3 mr-1" />
                                Shared
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground truncate">
                            Title: {template.titleTemplate}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {template.descriptionTemplate}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingTemplate(template)}
                            data-testid={`edit-template-${template.id}`}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => {
                              if (confirm('Delete this template?')) {
                                deleteTemplateMutation.mutate(template.id);
                              }
                            }}
                            data-testid={`delete-template-${template.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTemplateManager(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Template Dialog */}
      <Dialog open={!!editingTemplate} onOpenChange={(open) => !open && setEditingTemplate(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Template</DialogTitle>
            <DialogDescription>
              Update your template. Use placeholders like {"{year}"}, {"{make}"}, {"{model}"}, {"${price}"}, {"{mileage}"}.
            </DialogDescription>
          </DialogHeader>
          {editingTemplate && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-template-name">Template Name</Label>
                <Input 
                  id="edit-template-name"
                  value={editingTemplate.templateName}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, templateName: e.target.value })}
                  data-testid="input-edit-template-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-template-title">Title Template</Label>
                <Input 
                  id="edit-template-title"
                  value={editingTemplate.titleTemplate}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, titleTemplate: e.target.value })}
                  data-testid="input-edit-template-title"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-template-description">Description Template</Label>
                <Textarea 
                  id="edit-template-description"
                  className="min-h-[120px]"
                  value={editingTemplate.descriptionTemplate}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, descriptionTemplate: e.target.value })}
                  data-testid="input-edit-template-description"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="edit-template-shared"
                  checked={editingTemplate.isShared}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, isShared: e.target.checked })}
                  className="rounded"
                  data-testid="checkbox-template-shared"
                />
                <Label htmlFor="edit-template-shared" className="flex items-center gap-1 cursor-pointer">
                  <Share2 className="w-4 h-4" />
                  Share with team
                </Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingTemplate(null)}>
              Cancel
            </Button>
            <Button 
              onClick={() => {
                if (editingTemplate) {
                  updateTemplateMutation.mutate({
                    id: editingTemplate.id,
                    data: {
                      templateName: editingTemplate.templateName,
                      titleTemplate: editingTemplate.titleTemplate,
                      descriptionTemplate: editingTemplate.descriptionTemplate,
                      isShared: editingTemplate.isShared
                    }
                  });
                }
              }}
              disabled={updateTemplateMutation.isPending}
              className="gap-2"
              data-testid="save-edit-template-button"
            >
              {updateTemplateMutation.isPending ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mark Posted Dialog */}
      <Dialog
        open={showMarkPostedDialog}
        onOpenChange={(open) => {
          if (!open) {
            setShowMarkPostedDialog(false);
            setMarkPostedVehicleId(null);
            setMarkPostedBundleId(null);
            setMarkPostedUrl("");
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Mark Listing as Posted</DialogTitle>
            <DialogDescription>
              Paste the Marketplace listing URL so we can track this post.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {markPostedVehicle && (
              <div className="text-sm text-muted-foreground">
                {markPostedVehicle.year} {markPostedVehicle.make} {markPostedVehicle.model} {markPostedVehicle.trim}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="listing-url">Listing URL</Label>
              <Input
                id="listing-url"
                placeholder="https://www.facebook.com/marketplace/item/..."
                value={markPostedUrl}
                onChange={(e) => setMarkPostedUrl(e.target.value)}
                data-testid="input-listing-url"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowMarkPostedDialog(false);
                setMarkPostedVehicleId(null);
                setMarkPostedBundleId(null);
                setMarkPostedUrl("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (markPostedVehicleId) {
                  markPostedMutation.mutate({
                    vehicleId: markPostedVehicleId,
                    listingUrl: markPostedUrl.trim(),
                    bundleId: markPostedBundleId
                  });
                }
              }}
              disabled={!markPostedUrl.trim() || markPostedMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700"
              data-testid="confirm-mark-posted"
            >
              {markPostedMutation.isPending ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              Mark as Posted
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="container mx-auto px-4 py-6 space-y-6">
        <div className="bg-white/80 border border-blue-100 rounded-lg p-4 shadow-sm">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              <div className="flex-1">
                <h3 className="font-semibold text-[#022d60]">Compliant Messaging Tip</h3>
                <p className="text-sm text-muted-foreground">
                  Marketplace personal-profile messages can't be automated. Route buyers to your Page DM link for instant replies.
                </p>
              </div>
              <div className="w-full md:w-[420px] space-y-2">
                <div className="flex items-center justify-between">
                  <Label>DM Page</Label>
                  {includePageDmCta && !pageDmLink.trim() && (
                    <Badge variant="destructive">Missing DM Link</Badge>
                  )}
                </div>
                <Select
                  value={selectedPageId}
                  onValueChange={(value) => {
                    setSelectedPageId(value);
                    const selected = connectedPages.find((page) => page.pageId === value);
                    setPageDmLink(selected?.pageDmLink || dealershipSettings?.pageDmLink || "");
                  }}
                >
                  <SelectTrigger data-testid="select-dm-page">
                    <SelectValue placeholder="Select a Page" />
                  </SelectTrigger>
                  <SelectContent>
                    {connectedPages.map((page) => (
                      <SelectItem key={page.pageId} value={page.pageId}>
                        {page.pageName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  id="page-dm-link"
                  placeholder="https://m.me/yourdealership"
                  value={pageDmLink}
                  onChange={(e) => setPageDmLink(e.target.value)}
                  data-testid="input-page-dm-link"
                />
                <p className="text-xs text-muted-foreground">
                  Using saved Page DM link if available, or paste a link here for this session.
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3">
                <div>
                  <p className="text-sm font-medium">Smart Templates</p>
                  <p className="text-xs text-muted-foreground">Auto-select the best template per vehicle.</p>
                </div>
                <Switch checked={autoTemplate} onCheckedChange={setAutoTemplate} />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3">
                <div>
                  <p className="text-sm font-medium">Add Page DM CTA</p>
                  <p className="text-xs text-muted-foreground">Push buyers to Messenger for automation.</p>
                </div>
                <Switch checked={includePageDmCta} onCheckedChange={setIncludePageDmCta} />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3">
                <div>
                  <p className="text-sm font-medium">Compliance Footer</p>
                  <p className="text-xs text-muted-foreground">Auto-append disclaimers to listings.</p>
                </div>
                <Switch checked={includeComplianceFooter} onCheckedChange={setIncludeComplianceFooter} />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3">
                <div>
                  <p className="text-sm font-medium">Auto-Prep uses AI</p>
                  <p className="text-xs text-muted-foreground">Generate AI copy when auto-prepping bundles.</p>
                </div>
                <Switch checked={autoPrepUseAi} onCheckedChange={setAutoPrepUseAi} />
              </div>
            </div>

            {includeComplianceFooter && (
              <div className="space-y-2">
                <Label htmlFor="compliance-footer">Compliance Footer Text</Label>
                <Textarea
                  id="compliance-footer"
                  value={complianceFooter}
                  onChange={(e) => setComplianceFooter(e.target.value)}
                  className="min-h-[80px]"
                />
              </div>
            )}
          </div>
        </div>

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

            <Card className="bg-white/80 mt-6">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-[#1877f2]" />
                  Marketplace Copilot
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="copilot-vehicle">Vehicle (optional)</Label>
                  <Select value={copilotVehicleId} onValueChange={setCopilotVehicleId}>
                    <SelectTrigger id="copilot-vehicle">
                      <SelectValue placeholder="Choose a vehicle" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No vehicle selected</SelectItem>
                      {vehicles.map(vehicle => (
                        <SelectItem key={vehicle.id} value={String(vehicle.id)}>
                          {vehicle.year} {vehicle.make} {vehicle.model} {vehicle.trim || ""} {vehicle.stockNumber ? `(${vehicle.stockNumber})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="copilot-message">Buyer message</Label>
                  <Textarea
                    id="copilot-message"
                    className="min-h-[120px]"
                    placeholder="Paste the buyer's Marketplace message here..."
                    value={copilotMessage}
                    onChange={(e) => setCopilotMessage(e.target.value)}
                  />
                </div>
                <Button
                  onClick={() => copilotMutation.mutate()}
                  disabled={!copilotMessage.trim() || copilotMutation.isPending}
                  className="w-full"
                >
                  {copilotMutation.isPending ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4 mr-2" />
                  )}
                  Suggest Reply
                </Button>
                {copilotReply && (
                  <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-semibold text-slate-700">
                        Suggested Reply
                      </div>
                      <CopyButton text={copilotReply} label="Copy" size="sm" variant="outline" />
                    </div>
                    {copilotIntent && (
                      <Badge variant="secondary" className="text-xs">
                        Intent: {copilotIntent}
                      </Badge>
                    )}
                    <p className="text-xs text-slate-700 whitespace-pre-wrap">{copilotReply}</p>
                  </div>
                )}
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
                      onClick={() => autoPrepMutation.mutate()}
                      disabled={autoPrepMutation.isPending}
                      className="gap-2"
                    >
                      {autoPrepMutation.isPending ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Zap className="w-4 h-4" />
                      )}
                      Auto-Prep 10
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => prepAndLockMutation.mutate()}
                      disabled={prepAndLockMutation.isPending}
                      className="gap-2"
                    >
                      {prepAndLockMutation.isPending ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <ShieldCheck className="w-4 h-4" />
                      )}
                      Auto-Prep + Lock 10
                    </Button>
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
                          onMarkPosted={(id, bundleId) => {
                            setMarkPostedVehicleId(id);
                            setMarkPostedBundleId(bundleId ?? null);
                            setMarkPostedUrl("");
                            setShowMarkPostedDialog(true);
                          }}
                          pageDmLink={pageDmLink}
                          includePageDmCta={includePageDmCta}
                          includeComplianceFooter={includeComplianceFooter}
                          complianceFooter={complianceFooter}
                          autoTemplate={autoTemplate}
                          isGenerating={generateMutation.isPending}
                          isExpanded={expandedVehicles.includes(`vehicle-${vehicle.id}`)}
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
