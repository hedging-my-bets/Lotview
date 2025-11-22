import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PaymentProvider } from "@/contexts/PaymentContext";
import NotFound from "@/pages/not-found";
import Inventory from "@/pages/Inventory";
import VehicleDetail from "@/pages/VehicleDetail";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Inventory} />
      <Route path="/vehicle/:id" component={VehicleDetail} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <PaymentProvider>
        <TooltipProvider>
          <Router />
          <Toaster />
        </TooltipProvider>
      </PaymentProvider>
    </QueryClientProvider>
  );
}

export default App;
