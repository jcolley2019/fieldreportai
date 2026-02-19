import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { IdleTimeoutProvider } from "@/components/IdleTimeoutProvider";
import OfflineSyncProvider from "@/components/OfflineSyncProvider";
import Index from "./pages/Index";
import Landing from "./pages/Landing";
import Pricing from "./pages/Pricing";
import Auth from "./pages/Auth";
import Onboarding from "./pages/Onboarding";
import NewProject from "./pages/NewProject";
import ProjectsCustomers from "./pages/ProjectsCustomers";
import ProjectDetail from "./pages/ProjectDetail";
import Notes from "./pages/Notes";
import SavedNotes from "./pages/SavedNotes";
import CaptureScreen from "./pages/CaptureScreen";
import Checklist from "./pages/Checklist";
import ChecklistConfirmation from "./pages/ChecklistConfirmation";
import Confirmation from "./pages/Confirmation";
import FinalReport from "./pages/FinalReport";
import ReviewSummary from "./pages/ReviewSummary";
import Settings from "./pages/Settings";
import SavedReports from "./pages/SavedReports";
import AllContent from "./pages/AllContent";
import Tasks from "./pages/Tasks";
import CheckoutSuccess from "./pages/CheckoutSuccess";
import AdminMetrics from "./pages/AdminMetrics";
import SharedProject from "./pages/SharedProject";
import Install from "./pages/Install";
import NotFound from "./pages/NotFound";
import ProtectedRoute from "./components/ProtectedRoute";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <IdleTimeoutProvider>
          <OfflineSyncProvider />
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<Landing />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/shared/:token" element={<SharedProject />} />
            <Route path="/install" element={<Install />} />

            {/* Protected routes */}
            <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/new-project" element={<ProtectedRoute><NewProject /></ProtectedRoute>} />
            <Route path="/projects" element={<ProtectedRoute><ProjectsCustomers /></ProtectedRoute>} />
            <Route path="/project/:projectId" element={<ProtectedRoute><ProjectDetail /></ProtectedRoute>} />
            <Route path="/notes" element={<ProtectedRoute><Notes /></ProtectedRoute>} />
            <Route path="/saved-notes" element={<ProtectedRoute><SavedNotes /></ProtectedRoute>} />
            <Route path="/capture-screen" element={<ProtectedRoute><CaptureScreen /></ProtectedRoute>} />
            <Route path="/checklist" element={<ProtectedRoute><Checklist /></ProtectedRoute>} />
            <Route path="/checklist-confirmation" element={<ProtectedRoute><ChecklistConfirmation /></ProtectedRoute>} />
            <Route path="/confirmation" element={<ProtectedRoute><Confirmation /></ProtectedRoute>} />
            <Route path="/final-report" element={<ProtectedRoute><FinalReport /></ProtectedRoute>} />
            <Route path="/review-summary" element={<ProtectedRoute><ReviewSummary /></ProtectedRoute>} />
            <Route path="/saved-reports" element={<ProtectedRoute><SavedReports /></ProtectedRoute>} />
            <Route path="/all-content" element={<ProtectedRoute><AllContent /></ProtectedRoute>} />
            <Route path="/tasks" element={<ProtectedRoute><Tasks /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="/checkout-success" element={<ProtectedRoute><CheckoutSuccess /></ProtectedRoute>} />
            <Route path="/admin/metrics" element={<ProtectedRoute><AdminMetrics /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </IdleTimeoutProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
