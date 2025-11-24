import { Link } from "wouter";
import { Phone, MessageSquare, Menu } from "lucide-react";
import { useChat } from "@/contexts/ChatContext";
import { useState } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export function Navbar() {
  const { openChat } = useChat();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <nav className="fixed top-0 w-full z-50 bg-white border-b border-slate-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 py-3 md:py-4 flex justify-between items-center">
        {/* Logo */}
        <Link href="/">
          <div className="flex items-center gap-2 md:gap-3 cursor-pointer">
            <div className="w-8 h-8 md:w-10 md:h-10 bg-primary rounded-lg flex items-center justify-center text-white font-bold text-lg md:text-xl">
              O
            </div>
            <div className="hidden sm:block">
              <h1 className="font-bold text-primary leading-none text-sm md:text-base">
                OLYMPIC
                <br />
                <span className="text-[10px] tracking-widest opacity-70">AUTO GROUP</span>
              </h1>
            </div>
          </div>
        </Link>

        {/* Desktop Actions */}
        <div className="hidden md:flex gap-3 items-center">
          <button 
            onClick={() => openChat()}
            className="bg-white border-2 border-primary text-primary px-4 py-2 rounded-lg text-sm font-bold hover:bg-primary hover:text-white transition flex items-center gap-2"
            data-testid="button-chat-desktop"
          >
            <MessageSquare className="w-4 h-4" />
            Chat Now
          </button>
          <a 
            href="tel:+16041234567"
            className="bg-secondary text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-secondary/90 transition flex items-center gap-2"
            data-testid="button-phone-desktop"
          >
            <Phone className="w-4 h-4" />
            Contact Sales
          </a>
          <Sheet>
            <SheetTrigger asChild>
              <button
                className="w-9 h-9 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center hover:bg-slate-200 transition"
                data-testid="button-menu-desktop"
              >
                <Menu className="w-5 h-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[280px] p-6">
              <div className="flex flex-col gap-4 mt-8">
                <Link href="/login">
                  <button
                    className="w-full bg-slate-800 text-white py-3 rounded-lg text-sm font-bold hover:bg-slate-700 transition"
                    data-testid="link-admin-menu"
                  >
                    Admin Dashboard
                  </button>
                </Link>
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* Mobile Actions */}
        <div className="flex md:hidden items-center gap-2">
          <button
            onClick={() => openChat()}
            className="w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center"
            data-testid="button-chat-mobile"
          >
            <MessageSquare className="w-5 h-5" />
          </button>
          <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
            <SheetTrigger asChild>
              <button
                className="w-9 h-9 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center"
                data-testid="button-menu-mobile"
              >
                <Menu className="w-5 h-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[280px] p-6">
              <div className="flex flex-col gap-4 mt-8">
                <a
                  href="tel:+16041234567"
                  className="w-full bg-secondary text-white py-3 rounded-lg text-sm font-bold hover:bg-secondary/90 transition flex items-center justify-center gap-2"
                  onClick={() => setIsMenuOpen(false)}
                  data-testid="link-phone-menu"
                >
                  <Phone className="w-4 h-4" />
                  Call: (604) 123-4567
                </a>
                <Link href="/">
                  <button
                    className="w-full bg-white border-2 border-slate-200 text-slate-700 py-3 rounded-lg text-sm font-bold hover:border-primary hover:text-primary transition"
                    onClick={() => setIsMenuOpen(false)}
                    data-testid="link-inventory-menu"
                  >
                    View Inventory
                  </button>
                </Link>
                <Link href="/login">
                  <button
                    className="w-full bg-slate-800 text-white py-3 rounded-lg text-sm font-bold hover:bg-slate-700 transition"
                    onClick={() => setIsMenuOpen(false)}
                    data-testid="link-admin-menu-mobile"
                  >
                    Admin Dashboard
                  </button>
                </Link>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  );
}
