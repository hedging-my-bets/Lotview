import { Link, useLocation } from "wouter";
import { Phone, LayoutGrid, BarChart3 } from "lucide-react";

export function Navbar() {
  const [location] = useLocation();

  return (
    <nav className="fixed top-0 w-full z-50 p-2 md:p-4 pointer-events-none">
      <div className="max-w-7xl mx-auto glass-panel rounded-2xl px-6 py-4 flex justify-between items-center shadow-sm pointer-events-auto">
        <Link href="/">
          <div className="flex items-center gap-3 cursor-pointer">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center text-white font-bold text-xl">
              O
            </div>
            <div>
              <h1 className="font-bold text-primary leading-none">
                OLYMPIC<br />
                <span className="text-[10px] tracking-widest opacity-70">AUTO GROUP</span>
              </h1>
            </div>
          </div>
        </Link>
        
        <div className="flex gap-4">
          <Link href="/sales">
            <button className={`px-4 py-2 rounded-lg text-sm font-bold transition flex items-center gap-2 ${location === '/sales' ? 'bg-primary text-white' : 'text-slate-500 hover:text-primary'}`}>
              <BarChart3 className="w-4 h-4" />
              Dashboard
            </button>
          </Link>
          <button className="bg-secondary/10 text-secondary px-4 py-2 rounded-lg text-sm font-bold hover:bg-secondary/20 transition flex items-center gap-2">
            <Phone className="w-4 h-4" />
            Sales
          </button>
        </div>
      </div>
    </nav>
  );
}
