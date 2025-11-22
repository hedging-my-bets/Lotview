import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, MessageSquare } from "lucide-react";

interface ChatBotProps {
  vehicleName?: string;
}

export function ChatBot({ vehicleName }: ChatBotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);

  useEffect(() => {
    if (vehicleName && !hasOpened) {
      const timer = setTimeout(() => {
        setIsOpen(true);
        setHasOpened(true);
      }, 10000); // 10 seconds
      return () => clearTimeout(timer);
    }
  }, [vehicleName, hasOpened]);

  const message = vehicleName 
    ? `Hi there! I see you're looking at the ${vehicleName}. It's a great choice! Would you like to see the CarFax report or schedule a test drive?`
    : "Welcome to Olympic Auto Group! Can I help you find your dream car today?";

  return (
    <div className="fixed bottom-24 right-4 md:right-8 z-40 w-80 pointer-events-none">
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ x: 100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 100, opacity: 0 }}
            className="glass-panel rounded-2xl shadow-2xl overflow-hidden border border-blue-100 pointer-events-auto mb-4"
          >
            <div className="bg-primary p-4 flex items-center gap-3">
              <div className="relative">
                <img src="https://randomuser.me/api/portraits/men/32.jpg" className="w-10 h-10 rounded-full border-2 border-white" alt="Agent" />
                <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 rounded-full border-2 border-primary"></div>
              </div>
              <div>
                <p className="text-white font-bold text-sm">General Manager</p>
                <p className="text-blue-200 text-xs">Active Now</p>
              </div>
              <button onClick={() => setIsOpen(false)} className="ml-auto text-white/50 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 bg-slate-50">
              <div className="bg-white p-3 rounded-xl rounded-tl-none shadow-sm text-sm text-slate-600 leading-relaxed">
                {message}
              </div>
              <button className="mt-3 w-full bg-secondary text-white py-2 rounded-lg text-sm font-bold hover:bg-blue-600 transition">
                Yes, show me
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toggle Button */}
      {!isOpen && (
        <motion.button
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          onClick={() => setIsOpen(true)}
          className="pointer-events-auto absolute bottom-0 right-0 w-14 h-14 bg-primary rounded-full shadow-lg flex items-center justify-center text-white hover:bg-primary/90 transition-colors"
        >
          <MessageSquare className="w-6 h-6" />
        </motion.button>
      )}
    </div>
  );
}
