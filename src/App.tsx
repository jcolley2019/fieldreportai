import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Landing from "./pages/Landing";
import Pricing from "./pages/Pricing";
import Auth from "./pages/Auth";
import Onboarding from "./pages/Onboarding";
import NewProject from "./pages/NewProject";
import ProjectsCustomers from "./pages/ProjectsCustomers";
import ProjectDetail from "./pages/ProjectDetail";
import Notes from "./pages/Notes";
import CaptureScreen from "./pages/CaptureScreen";
import Checklist from "./pages/Checklist";
import ChecklistConfirmation from "./pages/ChecklistConfirmation";
import Confirmation from "./pages/Confirmation";
import FinalReport from "./pages/FinalReport";
import ReviewSummary from "./pages/ReviewSummary";
import Settings from "./pages/Settings";
import SavedReports from "./pages/SavedReports";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/dashboard" element={<Index />} />
          <Route path="/new-project" element={<NewProject />} />
          <Route path="/projects" element={<ProjectsCustomers />} />
          <Route path="/projects/:projectId" element={<ProjectDetail />} />
          <Route path="/notes" element={<Notes />} />
          <Route path="/capture-screen" element={<CaptureScreen />} />
          <Route path="/checklist" element={<Checklist />} />
          <Route path="/checklist-confirmation" element={<ChecklistConfirmation />} />
          <Route path="/confirmation" element={<Confirmation />} />
          <Route path="/final-report" element={<FinalReport />} />
          <Route path="/review-summary" element={<ReviewSummary />} />
          <Route path="/saved-reports" element={<SavedReports />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
