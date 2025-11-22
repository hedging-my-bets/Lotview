import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, MessageSquare } from "lucide-react";

interface ChatBotProps {
  vehicleName?: string;
  action?: string | null;
}

export function ChatBot({ vehicleName, action }: ChatBotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);

  // Open immediately if action is provided
  useEffect(() => {
    if (action && !hasOpened) {
      setIsOpen(true);
      setHasOpened(true);
    }
  }, [action, hasOpened]);

  // Auto-open after 10 seconds if no action
  useEffect(() => {
    if (vehicleName && !hasOpened && !action) {
      const timer = setTimeout(() => {
        setIsOpen(true);
        setHasOpened(true);
      }, 10000); // 10 seconds
      return () => clearTimeout(timer);
    }
  }, [vehicleName, hasOpened, action]);

  // Generate message based on action
  const getMessage = () => {
    if (!vehicleName) {
      return "Welcome to Olympic Auto Group! Can I help you find your dream car today?";
    }

    if (action === 'test-drive') {
      return `Perfect! You want to book a test drive for the ${vehicleName}. I can help you schedule that right away. What day works best for you this week?`;
    }
    
    if (action === 'reserve') {
      return `Great choice! You're interested in reserving the ${vehicleName}. To secure this vehicle, I'll need a few quick details. Would you like to proceed with a $500 refundable deposit?`;
    }

    return `Hi there! I see you're looking at the ${vehicleName}. It's a great choice! Would you like to see the CarFax report or schedule a test drive?`;
  };

  const message = getMessage();

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
