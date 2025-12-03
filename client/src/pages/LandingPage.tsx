import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Car, 
  MessageSquare, 
  Calculator, 
  Users, 
  Facebook, 
  Building2,
  ArrowRight,
  Check,
  Zap,
  Shield,
  BarChart3,
  Clock,
  Globe,
  ChevronRight,
  Star,
  Play,
  Sparkles,
  Mail,
  Phone,
  Heart
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getVehicles } from "@/lib/api";

export default function LandingPage() {
  const [isVisible, setIsVisible] = useState(false);
  
  // Fetch real vehicles for the preview
  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles-preview"],
    queryFn: getVehicles,
  });
  
  // Get first 3 vehicles for the hero preview
  const previewVehicles = vehicles.slice(0, 3);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  return (
    <div className="min-h-screen bg-white overflow-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <img 
                src="/attached_assets/Gemini_Generated_Image_x5uznsx5uznsx5uz_(1)_1764799238587.png" 
                alt="Lotview.ai" 
                className="h-10 w-auto"
              />
            </div>
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-sm text-gray-600 hover:text-[#022d60] transition-colors" data-testid="link-features">Features</a>
              <a href="#how-it-works" className="text-sm text-gray-600 hover:text-[#022d60] transition-colors" data-testid="link-how-it-works">How It Works</a>
              <a href="#pricing" className="text-sm text-gray-600 hover:text-[#022d60] transition-colors" data-testid="link-pricing">Pricing</a>
              <a href="#testimonials" className="text-sm text-gray-600 hover:text-[#022d60] transition-colors" data-testid="link-testimonials">Testimonials</a>
            </div>
            <div className="flex items-center gap-4">
              <Link href="/login">
                <Button variant="ghost" className="text-[#022d60]" data-testid="button-signin">
                  Sign In
                </Button>
              </Link>
              <a href="mailto:sales@lotview.ai?subject=Demo%20Request">
                <Button className="bg-[#022d60] hover:bg-[#022d60]/90 text-white" data-testid="button-demo">
                  Request Demo
                </Button>
              </a>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 lg:pt-40 lg:pb-32 overflow-hidden">
        {/* Background Effects */}
        <div className="absolute inset-0 bg-gradient-to-b from-blue-50/50 to-white pointer-events-none" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-gradient-radial from-[#00aad2]/10 to-transparent rounded-full blur-3xl" />
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-4xl mx-auto">
            <div 
              className={`transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
            >
              <Badge className="mb-6 bg-[#00aad2]/10 text-[#00aad2] border-[#00aad2]/20 hover:bg-[#00aad2]/10">
                <Sparkles className="w-3 h-3 mr-1" />
                AI-Powered Inventory Platform
              </Badge>
              
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-[#022d60] tracking-tight leading-[1.1] mb-6">
                Your Dealership's
                <span className="block bg-gradient-to-r from-[#022d60] via-[#00aad2] to-[#022d60] bg-clip-text text-transparent">
                  Digital Showroom
                </span>
              </h1>
              
              <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-10 leading-relaxed">
                The AI-powered inventory platform that turns browsers into buyers. 
                Manage listings, engage customers, and close more deals—all from one place.
              </p>
              
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <a href="mailto:sales@lotview.ai?subject=Demo%20Request">
                  <Button size="lg" className="bg-[#022d60] hover:bg-[#022d60]/90 text-white px-8 py-6 text-lg rounded-xl shadow-lg shadow-[#022d60]/25 hover:shadow-xl hover:shadow-[#022d60]/30 transition-all" data-testid="button-hero-demo">
                    Request a Demo
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>
                </a>
                <a href="#how-it-works">
                  <Button size="lg" variant="outline" className="px-8 py-6 text-lg rounded-xl border-gray-200 hover:border-[#022d60]/30 hover:bg-gray-50" data-testid="button-hero-tour">
                    <Play className="mr-2 w-5 h-5" />
                    Watch Demo
                  </Button>
                </a>
              </div>
            </div>
            
            {/* Hero Image/Mockup */}
            <div 
              className={`mt-16 transition-all duration-1000 delay-300 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}
            >
              <div className="relative mx-auto max-w-5xl">
                <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent z-10 pointer-events-none" />
                <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl shadow-2xl shadow-gray-900/20 p-2 sm:p-4">
                  <div className="bg-gray-900 rounded-xl overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-3 bg-gray-800/50 border-b border-gray-700/50">
                      <div className="flex gap-1.5">
                        <div className="w-3 h-3 rounded-full bg-red-500/80" />
                        <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                        <div className="w-3 h-3 rounded-full bg-green-500/80" />
                      </div>
                      <div className="flex-1 flex justify-center">
                        <div className="bg-gray-700/50 rounded-md px-4 py-1 text-xs text-gray-400">
                          yourdealership.lotview.ai
                        </div>
                      </div>
                    </div>
                    <div className="aspect-[16/9] bg-gradient-to-br from-[#022d60] to-[#00aad2]/80 flex items-center justify-center">
                      <div className="grid grid-cols-3 gap-4 p-8 w-full max-w-3xl">
                        {previewVehicles.length > 0 ? (
                          previewVehicles.map((vehicle, i) => (
                            <div key={vehicle.id || i} className="bg-white/10 backdrop-blur rounded-lg p-4 space-y-3">
                              <div className="aspect-[4/3] bg-white/5 rounded-md overflow-hidden">
                                {vehicle.images && vehicle.images[0] ? (
                                  <img 
                                    src={vehicle.images[0]} 
                                    alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <Car className="w-8 h-8 text-white/60" />
                                  </div>
                                )}
                              </div>
                              <div className="text-white/90 text-sm font-medium truncate">
                                {vehicle.year} {vehicle.make} {vehicle.model}
                              </div>
                              <div className="text-[#00aad2] text-sm font-bold">
                                ${vehicle.price?.toLocaleString()}
                              </div>
                            </div>
                          ))
                        ) : (
                          [1, 2, 3].map((i) => (
                            <div key={i} className="bg-white/10 backdrop-blur rounded-lg p-4 space-y-3 animate-pulse">
                              <div className="aspect-[4/3] bg-white/20 rounded-md flex items-center justify-center">
                                <Car className="w-8 h-8 text-white/60" />
                              </div>
                              <div className="h-2 bg-white/30 rounded w-3/4" />
                              <div className="h-2 bg-white/20 rounded w-1/2" />
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trusted By Section */}
      <section className="py-16 border-y border-gray-100 bg-gray-50/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm font-medium text-gray-500 mb-8">
            TRUSTED BY LEADING CANADIAN DEALERSHIPS
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6 opacity-60">
            <div className="flex items-center gap-2">
              <Building2 className="w-6 h-6 text-[#022d60]" />
              <span className="text-lg font-semibold text-gray-700">Olympic Hyundai Vancouver</span>
            </div>
            <div className="flex items-center gap-2">
              <Building2 className="w-6 h-6 text-[#022d60]" />
              <span className="text-lg font-semibold text-gray-700">Boundary Hyundai</span>
            </div>
            <div className="flex items-center gap-2">
              <Building2 className="w-6 h-6 text-[#022d60]" />
              <span className="text-lg font-semibold text-gray-700">Kia Vancouver</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 lg:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <Badge className="mb-4 bg-[#00aad2]/10 text-[#00aad2] border-[#00aad2]/20">
              Features
            </Badge>
            <h2 className="text-4xl lg:text-5xl font-bold text-[#022d60] mb-6">
              Everything You Need to Sell More Cars
            </h2>
            <p className="text-lg text-gray-600">
              A complete platform designed for modern dealerships. From inventory management to customer engagement, we've got you covered.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: Car,
                title: "Smart Inventory Management",
                description: "Automated syncing from CarGurus, AutoTrader, and your DMS. Real-time updates across all platforms in one dashboard.",
                color: "from-blue-500 to-blue-600"
              },
              {
                icon: MessageSquare,
                title: "AI-Powered Customer Chat",
                description: "24/7 intelligent chatbot answers questions, handles financing inquiries, and books test drives automatically.",
                color: "from-purple-500 to-purple-600"
              },
              {
                icon: Calculator,
                title: "Integrated Financing Calculator",
                description: "Configurable credit tiers and rates with real-time payment estimates on every vehicle listing.",
                color: "from-green-500 to-green-600"
              },
              {
                icon: Heart,
                title: "Automated Lead Nurturing",
                description: "Engage customers through webchat, text, and email. Automated follow-ups that convert browsers into buyers.",
                color: "from-orange-500 to-orange-600"
              },
              {
                icon: Facebook,
                title: "Facebook & Social Posting",
                description: "One-click vehicle posting to Facebook Marketplace. Automated catalog sync for paid automotive ads.",
                color: "from-sky-500 to-sky-600"
              },
              {
                icon: Building2,
                title: "Multi-Location Support",
                description: "Each dealership gets their own branded subdomain. Centralized management with role-based access.",
                color: "from-rose-500 to-rose-600"
              }
            ].map((feature, index) => (
              <Card 
                key={index} 
                className="group relative overflow-hidden border-gray-100 hover:border-[#00aad2]/30 hover:shadow-xl transition-all duration-300"
                data-testid={`card-feature-${index}`}
              >
                <CardContent className="p-8">
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition-transform`}>
                    <feature.icon className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-xl font-semibold text-[#022d60] mb-3">{feature.title}</h3>
                  <p className="text-gray-600 leading-relaxed">{feature.description}</p>
                </CardContent>
                <div className="absolute inset-0 bg-gradient-to-br from-[#00aad2]/0 to-[#00aad2]/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-24 lg:py-32 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <Badge className="mb-4 bg-[#022d60]/10 text-[#022d60] border-[#022d60]/20">
              How It Works
            </Badge>
            <h2 className="text-4xl lg:text-5xl font-bold text-[#022d60] mb-6">
              Live in 24 Hours
            </h2>
            <p className="text-lg text-gray-600">
              Getting started with Lotview is simple. We handle the heavy lifting so you can focus on selling cars.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              {
                step: "01",
                icon: Globe,
                title: "Connect",
                description: "Link your inventory sources—CarGurus, AutoTrader, or your existing DMS system."
              },
              {
                step: "02",
                icon: Sparkles,
                title: "Customize",
                description: "Add your branding, set up financing rules, and configure your sales team access."
              },
              {
                step: "03",
                icon: Zap,
                title: "Launch",
                description: "Your digital showroom goes live on your own branded subdomain instantly."
              },
              {
                step: "04",
                icon: BarChart3,
                title: "Grow",
                description: "AI chat engages customers 24/7 while you focus on closing deals."
              }
            ].map((item, index) => (
              <div key={index} className="relative" data-testid={`step-${index}`}>
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white border-2 border-[#022d60]/10 shadow-lg mb-6">
                    <item.icon className="w-8 h-8 text-[#00aad2]" />
                  </div>
                  <div className="text-xs font-bold text-[#00aad2] mb-2">STEP {item.step}</div>
                  <h3 className="text-xl font-semibold text-[#022d60] mb-3">{item.title}</h3>
                  <p className="text-gray-600">{item.description}</p>
                </div>
                {index < 3 && (
                  <div className="hidden lg:block absolute top-8 left-[calc(100%_-_1rem)] w-8">
                    <ChevronRight className="w-6 h-6 text-gray-300" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 bg-[#022d60]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">
              Dealers See Real Results
            </h2>
            <p className="text-lg text-white/70">
              Join the dealerships already transforming their digital presence.
            </p>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { value: "40%", label: "More Leads", sublabel: "from website chat" },
              { value: "2x", label: "Faster Updates", sublabel: "inventory sync speed" },
              { value: "24/7", label: "Customer Engagement", sublabel: "AI never sleeps" },
              { value: "100%", label: "Inventory Accuracy", sublabel: "real-time sync" }
            ].map((stat, index) => (
              <div key={index} className="text-center" data-testid={`stat-${index}`}>
                <div className="text-4xl lg:text-5xl font-bold text-white mb-2">{stat.value}</div>
                <div className="text-lg font-medium text-[#00aad2]">{stat.label}</div>
                <div className="text-sm text-white/50">{stat.sublabel}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-24 lg:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <Badge className="mb-4 bg-[#00aad2]/10 text-[#00aad2] border-[#00aad2]/20">
              Testimonials
            </Badge>
            <h2 className="text-4xl lg:text-5xl font-bold text-[#022d60] mb-6">
              Loved by Dealerships
            </h2>
            <p className="text-lg text-gray-600">
              Don't just take our word for it—hear from the dealerships using Lotview every day.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                quote: "Lotview transformed how we manage our online presence. Our customers can browse, calculate payments, and book test drives without us lifting a finger.",
                author: "Riley M.",
                role: "Sales Manager",
                dealership: "Olympic Hyundai Vancouver"
              },
              {
                quote: "The AI chatbot has been a game-changer. We're capturing leads at 2 AM that we would have completely missed before.",
                author: "Mike S.",
                role: "General Manager",
                dealership: "Boundary Hyundai"
              },
              {
                quote: "Setting up was incredibly easy. We were live within a day, and the team has been fantastic with ongoing support.",
                author: "Sarah K.",
                role: "Marketing Director",
                dealership: "Kia Vancouver"
              }
            ].map((testimonial, index) => (
              <Card key={index} className="border-gray-100 hover:shadow-lg transition-shadow" data-testid={`testimonial-${index}`}>
                <CardContent className="p-8">
                  <div className="flex gap-1 mb-4">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star key={star} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                  <blockquote className="text-gray-700 leading-relaxed mb-6">
                    "{testimonial.quote}"
                  </blockquote>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#022d60] to-[#00aad2] flex items-center justify-center text-white font-semibold">
                      {testimonial.author.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <div className="font-semibold text-[#022d60]">{testimonial.author}</div>
                      <div className="text-sm text-gray-500">{testimonial.role}, {testimonial.dealership}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 lg:py-32 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <Badge className="mb-4 bg-[#022d60]/10 text-[#022d60] border-[#022d60]/20">
              Pricing
            </Badge>
            <h2 className="text-4xl lg:text-5xl font-bold text-[#022d60] mb-6">
              Plans That Scale With You
            </h2>
            <p className="text-lg text-gray-600">
              Choose the plan that fits your dealership. All plans include our core inventory management features.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[
              {
                name: "Starter",
                price: "$199",
                period: "/month",
                description: "Perfect for single-location dealerships getting started with digital.",
                features: [
                  "1 dealership location",
                  "Inventory management",
                  "Basic AI chat",
                  "Financing calculator",
                  "Email support"
                ],
                cta: "Get Started",
                highlighted: false
              },
              {
                name: "Professional",
                price: "$499",
                period: "/month",
                description: "For growing dealer groups with multiple locations and advanced needs.",
                features: [
                  "Up to 5 locations",
                  "Everything in Starter",
                  "Advanced AI chat + CRM sync",
                  "Facebook Marketplace posting",
                  "Priority support"
                ],
                cta: "Get Started",
                highlighted: true
              },
              {
                name: "Enterprise",
                price: "Custom",
                period: "",
                description: "For large dealer groups with custom integration requirements.",
                features: [
                  "Unlimited locations",
                  "Everything in Professional",
                  "Custom integrations",
                  "Dedicated account manager",
                  "SLA & 24/7 support"
                ],
                cta: "Contact Sales",
                highlighted: false
              }
            ].map((plan, index) => (
              <Card 
                key={index} 
                className={`relative overflow-hidden ${plan.highlighted ? 'border-2 border-[#00aad2] shadow-xl shadow-[#00aad2]/10' : 'border-gray-200'}`}
                data-testid={`pricing-${plan.name.toLowerCase()}`}
              >
                {plan.highlighted && (
                  <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-[#022d60] to-[#00aad2] text-white text-center py-1 text-sm font-medium">
                    Most Popular
                  </div>
                )}
                <CardContent className={`p-8 ${plan.highlighted ? 'pt-12' : ''}`}>
                  <h3 className="text-xl font-semibold text-[#022d60] mb-2">{plan.name}</h3>
                  <div className="flex items-baseline gap-1 mb-4">
                    <span className="text-4xl font-bold text-[#022d60]">{plan.price}</span>
                    <span className="text-gray-500">{plan.period}</span>
                  </div>
                  <p className="text-gray-600 mb-6">{plan.description}</p>
                  <ul className="space-y-3 mb-8">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <Check className="w-5 h-5 text-[#00aad2]" />
                        <span className="text-gray-700">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <a href="mailto:sales@lotview.ai?subject=Pricing%20Inquiry">
                    <Button 
                      className={`w-full ${plan.highlighted ? 'bg-[#022d60] hover:bg-[#022d60]/90 text-white' : 'bg-white border-2 border-[#022d60] text-[#022d60] hover:bg-gray-50'}`}
                      data-testid={`button-pricing-${plan.name.toLowerCase()}`}
                    >
                      {plan.cta}
                    </Button>
                  </a>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-24 lg:py-32 bg-gradient-to-br from-[#022d60] via-[#022d60] to-[#00aad2]/80 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMtOS45NDEgMC0xOCA4LjA1OS0xOCAxOHM4LjA1OSAxOCAxOCAxOCAxOC04LjA1OSAxOC0xOC04LjA1OS0xOC0xOC0xOHptMCAzMmMtNy43MzIgMC0xNC02LjI2OC0xNC0xNHM2LjI2OC0xNCAxNC0xNCAxNCA2LjI2OCAxNCAxNC02LjI2OCAxNC0xNCAxNHoiIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iLjAzIi8+PC9nPjwvc3ZnPg==')] opacity-30" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl lg:text-5xl font-bold text-white mb-6">
            Ready to Modernize Your Dealership?
          </h2>
          <p className="text-xl text-white/80 mb-10 max-w-2xl mx-auto">
            Join the dealerships already using Lotview to sell more cars. Get started in 24 hours with a platform designed for the modern automotive industry.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a href="mailto:sales@lotview.ai?subject=Demo%20Request">
              <Button size="lg" className="bg-white text-[#022d60] hover:bg-gray-100 px-8 py-6 text-lg rounded-xl shadow-lg" data-testid="button-cta-demo">
                Request a Demo
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </a>
            <a href="mailto:sales@lotview.ai?subject=Free%20Trial%20Request">
              <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10 px-8 py-6 text-lg rounded-xl" data-testid="button-cta-trial">
                Start Free Trial
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-16 bg-gray-900 text-gray-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-[#022d60] to-[#00aad2] rounded-lg flex items-center justify-center">
                  <Car className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold text-white">Lotview.ai</span>
              </div>
              <p className="text-sm">
                The AI-powered inventory platform for modern Canadian dealerships.
              </p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#pricing" className="hover:text-white transition-colors">Pricing</a></li>
                <li><a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="mailto:sales@lotview.ai" className="hover:text-white transition-colors">Contact</a></li>
                <li><a href="#testimonials" className="hover:text-white transition-colors">Testimonials</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/privacy-policy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
                <li><Link href="/terms-of-service" className="hover:text-white transition-colors">Terms of Service</Link></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-gray-800 text-center text-sm">
            <p>&copy; {new Date().getFullYear()} Lotview.ai — Built for Canadian Dealerships</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
