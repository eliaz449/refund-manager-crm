import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { useAuth } from "@/hooks/use-auth";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Clients from "@/pages/clients";
import ClientDetail from "@/pages/client-detail";
import Transactions from "@/pages/transactions";
import Settings from "@/pages/settings";
import WebhookEvents from "@/pages/webhook-events";
import LoginPage from "@/pages/login";
import PartnerDashboard from "@/pages/partner-dashboard";
import PartnersPage from "@/pages/partners";
import { Loader2 } from "lucide-react";
import { ReminderNotifications } from "@/hooks/use-reminder-notifications";
import { ErrorBoundary } from "@/components/error-boundary";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/clients" component={Clients} />
      <Route path="/clients/:id" component={ClientDetail} />
      <Route path="/cases"><Redirect to="/clients" /></Route>
      <Route path="/tasks"><Redirect to="/clients" /></Route>
      <Route path="/payments"><Redirect to="/clients" /></Route>
      <Route path="/transactions" component={Transactions} />
      <Route path="/partners" component={PartnersPage} />
      <Route path="/settings" component={Settings} />
      <Route path="/webhook-events" component={WebhookEvents} />
      <Route component={NotFound} />
    </Switch>
  );
}

const sidebarStyle = {
  "--sidebar-width": "16rem",
  "--sidebar-width-icon": "3rem",
};

function AuthenticatedApp() {
  const { user, isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  // Partners get a stripped-down view — only the partner dashboard, no sidebar
  if (user?.role === "partner") {
    return (
      <ErrorBoundary name="partner-app">
        <PartnerDashboard />
      </ErrorBoundary>
    );
  }

  return (
    <SidebarProvider style={sidebarStyle as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <header className="flex items-center gap-2 p-2 border-b h-12 flex-shrink-0">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <span className="text-sm font-medium text-muted-foreground">מערכת ניהול מס והנהלת חשבונות</span>
            <div className="flex-1" />
            <span className="text-xs text-muted-foreground" data-testid="text-user-name">
              {user?.fullName}
            </span>
          </header>
          <main className="flex-1 overflow-hidden">
            <ErrorBoundary name="router">
              <Router />
            </ErrorBoundary>
          </main>
        </div>
      </div>
      <ErrorBoundary name="reminders" fallback={null}>
        <ReminderNotifications />
      </ErrorBoundary>
    </SidebarProvider>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ErrorBoundary name="root">
          <AuthenticatedApp />
        </ErrorBoundary>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
