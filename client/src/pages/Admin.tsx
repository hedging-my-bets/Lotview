import { useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Key, Bot, Save } from "lucide-react";

export default function Admin() {
  const { toast } = useToast();
  const [ghlApiKey, setGhlApiKey] = useState("");
  const [ghlLocationId, setGhlLocationId] = useState("");
  const [aiPromptTemplate, setAiPromptTemplate] = useState("");

  const handleSaveGHL = async () => {
    try {
      const response = await fetch("/api/admin/ghl-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: ghlApiKey,
          locationId: ghlLocationId,
        }),
      });

      if (!response.ok) throw new Error("Failed to save GHL configuration");

      toast({
        title: "Success",
        description: "GoHighLevel configuration saved successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save GHL configuration.",
        variant: "destructive",
      });
    }
  };

  const handleSavePrompt = async () => {
    try {
      const response = await fetch("/api/admin/ai-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Vehicle Description",
          promptText: aiPromptTemplate,
          isActive: true,
        }),
      });

      if (!response.ok) throw new Error("Failed to save AI prompt");

      toast({
        title: "Success",
        description: "AI prompt template saved successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save AI prompt template.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      
      <div className="pt-28 pb-20 px-4 max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-slate-900 mb-8">Admin Panel</h1>

        <div className="space-y-6">
          {/* GoHighLevel Configuration */}
          <Card data-testid="card-ghl-config">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="w-5 h-5" />
                GoHighLevel Integration
              </CardTitle>
              <CardDescription>
                Configure your GoHighLevel API credentials to send leads directly to your CRM.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ghl-api-key">API Key</Label>
                <Input
                  id="ghl-api-key"
                  type="password"
                  placeholder="Enter your GHL API key"
                  value={ghlApiKey}
                  onChange={(e) => setGhlApiKey(e.target.value)}
                  data-testid="input-ghl-api-key"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ghl-location-id">Location ID</Label>
                <Input
                  id="ghl-location-id"
                  placeholder="Enter your GHL location ID"
                  value={ghlLocationId}
                  onChange={(e) => setGhlLocationId(e.target.value)}
                  data-testid="input-ghl-location-id"
                />
              </div>

              <Button onClick={handleSaveGHL} className="w-full" data-testid="button-save-ghl">
                <Save className="w-4 h-4 mr-2" />
                Save GHL Configuration
              </Button>
            </CardContent>
          </Card>

          {/* AI Prompt Template */}
          <Card data-testid="card-ai-prompt">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="w-5 h-5" />
                AI Description Prompt
              </CardTitle>
              <CardDescription>
                Customize how ChatGPT generates vehicle descriptions. Use placeholders like {'{{YEAR}}'}, {'{{MAKE}}'}, {'{{MODEL}}'}, etc.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ai-prompt">Prompt Template</Label>
                <Textarea
                  id="ai-prompt"
                  rows={12}
                  placeholder="Enter your custom AI prompt template with placeholders..."
                  value={aiPromptTemplate}
                  onChange={(e) => setAiPromptTemplate(e.target.value)}
                  className="font-mono text-sm"
                  data-testid="textarea-ai-prompt"
                />
                <p className="text-xs text-slate-500">
                  Available placeholders: {'{{YEAR}}'}, {'{{MAKE}}'}, {'{{MODEL}}'}, {'{{TRIM}}'}, {'{{TYPE}}'}, 
                  {'{{PRICE}}'}, {'{{ODOMETER}}'}, {'{{BADGES}}'}, {'{{DEALERSHIP}}'}, {'{{LOCATION}}'}, {'{{FULL_CONTENT}}'}
                </p>
              </div>

              <Button onClick={handleSavePrompt} className="w-full" data-testid="button-save-prompt">
                <Save className="w-4 h-4 mr-2" />
                Save AI Prompt Template
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
