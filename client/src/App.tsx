import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PaymentProvider } from "@/contexts/PaymentContext";
import { ChatProvider } from "@/contexts/ChatContext";
import NotFound from "@/pages/not-found";
import Inventory from "@/pages/Inventory";
import VehicleDetail from "@/pages/VehicleDetail";
import EmbedWidget from "@/pages/EmbedWidget";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Inventory} />
      <Route path="/vehicle/:id" component={VehicleDetail} />
      <Route path="/embed" component={EmbedWidget} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <PaymentProvider>
        <ChatProvider>
          <TooltipProvider>
            <Router />
            <Toaster />
          </TooltipProvider>
        </ChatProvider>
      </PaymentProvider>
    </QueryClientProvider>
  );
}

export default App;
