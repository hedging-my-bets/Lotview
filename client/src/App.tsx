import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import { PaymentProvider } from "@/contexts/PaymentContext";
import { ChatProvider } from "@/contexts/ChatContext";
import NotFound from "@/pages/not-found";
import Inventory from "@/pages/Inventory";
import VehicleDetail from "@/pages/VehicleDetail";
import EmbedWidget from "@/pages/EmbedWidget";
import Admin from "@/pages/Admin";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Manager from "@/pages/Manager";
import Sales from "@/pages/Sales";
import SuperAdminDashboard from "@/pages/SuperAdminDashboard";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Inventory} />
      <Route path="/vehicle/:id" component={VehicleDetail} />
      <Route path="/login" component={Login} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/manager" component={Manager} />
      <Route path="/sales" component={Sales} />
      <Route path="/admin" component={Admin} />
      <Route path="/super-admin" component={SuperAdminDashboard} />
      <Route path="/embed" component={EmbedWidget} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="olympic-theme">
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
    </ThemeProvider>
  );
}

export default App;
