import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import Home from "./pages/Home";
import ConnectionsPage from "./pages/Connections";
import QuizzesPage from "./pages/Quizzes";
import SnapshotDetailPage from "./pages/SnapshotDetail";
import ReviewsPage from "./pages/Reviews";
import SimulationsPage from "./pages/Simulations";
import SimulationDetailPage from "./pages/SimulationDetail";
import PatchesPage from "./pages/Patches";
import ReportsPage from "./pages/Reports";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/connections" component={ConnectionsPage} />
      <Route path="/quizzes" component={QuizzesPage} />
      <Route path="/snapshots/:id" component={SnapshotDetailPage} />
      <Route path="/reviews" component={ReviewsPage} />
      <Route path="/simulations" component={SimulationsPage} />
      <Route path="/simulations/:id" component={SimulationDetailPage} />
      <Route path="/patches" component={PatchesPage} />
      <Route path="/reports" component={ReportsPage} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <DashboardLayout>
            <Router />
          </DashboardLayout>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
