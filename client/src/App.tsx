import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Connections from "./pages/Connections";
import Quizzes from "./pages/Quizzes";
import SnapshotDetail from "./pages/SnapshotDetail";
import Reviews from "./pages/Reviews";
import Simulations from "./pages/Simulations";
import SimulationDetail from "./pages/SimulationDetail";
import Patches from "./pages/Patches";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import Scheduler from "./pages/Scheduler";
import DiffViewer from "./pages/DiffViewer";
import TestPage from "./pages/TestPage";
import QuizSettingsAudit from "./pages/QuizSettingsAudit";
import VideoVerifier from "./pages/VideoVerifier";
import QuizBrowser from "./pages/QuizBrowser";
import SubmitVideo from "./pages/SubmitVideo";
import ContestResults from "./pages/ContestResults";
import OfflineContest from "./pages/OfflineContest";
import AnomalyDetector from "./pages/AnomalyDetector";
import RiskKnowledgeBase from "./pages/RiskKnowledgeBase";
import BehavioralProfiles from "./pages/BehavioralProfiles";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/connections" component={Connections} />
      <Route path="/quizzes" component={Quizzes} />
      <Route path="/quizzes/snapshot/:id" component={SnapshotDetail} />
      <Route path="/reviews" component={Reviews} />
      <Route path="/simulations" component={Simulations} />
      <Route path="/simulations/:id" component={SimulationDetail} />
      <Route path="/patches" component={Patches} />
      <Route path="/reports" component={Reports} />
      <Route path="/settings" component={Settings} />
      <Route path="/scheduler" component={Scheduler} />
      <Route path="/diff" component={DiffViewer} />
      <Route path="/test-page" component={TestPage} />
      <Route path="/settings-audit" component={QuizSettingsAudit} />
      <Route path="/video-verifier" component={VideoVerifier} />
      <Route path="/quiz-browser" component={QuizBrowser} />
      <Route path="/contest-results" component={ContestResults} />
      <Route path="/offline-contest" component={OfflineContest} />
      <Route path="/anomaly-detector" component={AnomalyDetector} />
      <Route path="/risk-kb" component={RiskKnowledgeBase} />
      <Route path="/behavioral-profiles" component={BehavioralProfiles} />
      {/* Public route — no auth required */}
      <Route path="/submit-video" component={SubmitVideo} />
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
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
