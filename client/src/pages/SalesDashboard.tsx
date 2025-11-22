import { useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Facebook, Layout, Video, Plus, Check, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { MOCK_INVENTORY } from "@/lib/mockData";

export default function SalesDashboard() {
  const { toast } = useToast();
  const [connectedPages, setConnectedPages] = useState<string[]>(["Olympic Hyundai Main"]);
  const [selectedTemplate, setSelectedTemplate] = useState("modern");
  
  const handleConnect = () => {
    const pages = ["Olympic Hyundai North", "Olympic Luxury", "Vancouver Trucks"];
    const next = pages.find(p => !connectedPages.includes(p));
    if (next) {
      setConnectedPages([...connectedPages, next]);
      toast({ title: "Page Connected", description: `Successfully connected ${next}` });
    } else {
      toast({ title: "Limit Reached", description: "You can only connect up to 4 pages.", variant: "destructive" });
    }
  };

  const handleGenerate = () => {
    toast({ title: "Generating Assets", description: "Gemini is creating unique video content for your inventory..." });
    setTimeout(() => {
      toast({ title: "Generation Complete", description: "3 new videos added to your library." });
    }, 3000);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      
      <div className="pt-28 pb-20 px-4 max-w-7xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-black text-slate-900">Sales Dashboard</h1>
          <p className="text-slate-500">Manage your social presence and automated content.</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Connected Pages */}
          <div className="glass-panel p-6 rounded-2xl space-y-6">
            <h2 className="font-bold text-lg flex items-center gap-2">
              <Facebook className="w-5 h-5 text-blue-600" /> Connected Pages
            </h2>
            <div className="space-y-3">
              {connectedPages.map(page => (
                <div key={page} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold">f</div>
                    <span className="font-medium text-sm">{page}</span>
                  </div>
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                </div>
              ))}
              {connectedPages.length < 4 && (
                <button onClick={handleConnect} className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 font-bold text-sm hover:border-primary hover:text-primary transition flex items-center justify-center gap-2">
                  <Plus className="w-4 h-4" /> Connect Page
                </button>
              )}
            </div>
          </div>

          {/* Content Automation */}
          <div className="glass-panel p-6 rounded-2xl space-y-6 lg:col-span-2">
            <h2 className="font-bold text-lg flex items-center gap-2">
              <Layout className="w-5 h-5 text-purple-600" /> Content Automation
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase mb-3 block">Select Template</label>
                <div className="grid grid-cols-2 gap-3">
                  {['Modern', 'Classic', 'Bold', 'Minimal'].map(t => (
                    <div 
                      key={t}
                      onClick={() => setSelectedTemplate(t.toLowerCase())}
                      className={`p-4 rounded-xl border-2 cursor-pointer transition ${selectedTemplate === t.toLowerCase() ? 'border-primary bg-primary/5' : 'border-slate-100 hover:border-primary/50'}`}
                    >
                      <div className="h-20 bg-slate-200 rounded-lg mb-2 opacity-50"></div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-bold">{t}</span>
                        {selectedTemplate === t.toLowerCase() && <Check className="w-4 h-4 text-primary" />}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                 <label className="text-xs font-bold text-slate-400 uppercase mb-3 block">Priority Inventory</label>
                 <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                    {MOCK_INVENTORY.slice(0, 4).map(car => (
                      <div key={car.id} className="flex items-center gap-3 p-2 bg-white rounded-lg border border-slate-100">
                        <img src={car.image} className="w-12 h-12 rounded-lg object-cover" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold truncate">{car.year} {car.model}</p>
                          <p className="text-xs text-slate-500">${car.price.toLocaleString()}</p>
                        </div>
                        <div className="flex gap-1">
                          <div className="w-6 h-6 rounded bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500">1</div>
                        </div>
                      </div>
                    ))}
                 </div>
              </div>
            </div>
          </div>

          {/* AI Video Gen */}
          <div className="glass-panel p-6 rounded-2xl space-y-6 lg:col-span-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white border-none">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="font-bold text-xl flex items-center gap-2 mb-1">
                  <Video className="w-6 h-6" /> Gemini Video Creator
                </h2>
                <p className="text-indigo-100 opacity-90">Generate unique video ads for remarketing lists automatically.</p>
              </div>
              <button onClick={handleGenerate} className="bg-white text-indigo-600 px-6 py-3 rounded-xl font-bold shadow-lg hover:bg-indigo-50 transition flex items-center gap-2">
                <Video className="w-4 h-4" /> Generate Now
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
