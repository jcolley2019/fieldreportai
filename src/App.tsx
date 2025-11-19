import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Landing from "./pages/Landing";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NewReport from "./pages/NewReport";
import CaptureScreen from "./pages/CaptureScreen";
import ReviewSummary from "./pages/ReviewSummary";
import FinalReport from "./pages/FinalReport";
import Settings from "./pages/Settings";
import Confirmation from "./pages/Confirmation";
import ChecklistConfirmation from "./pages/ChecklistConfirmation";
import Checklist from "./pages/Checklist";
import Notes from "./pages/Notes";
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
          <Route path="/dashboard" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/new-report" element={<NewReport />} />
          <Route path="/capture-screen" element={<CaptureScreen />} />
          <Route path="/review-summary" element={<ReviewSummary />} />
          <Route path="/final-report" element={<FinalReport />} />
          <Route path="/confirmation" element={<Confirmation />} />
          <Route path="/checklist-confirmation" element={<ChecklistConfirmation />} />
          <Route path="/checklist" element={<Checklist />} />
          <Route path="/notes" element={<Notes />} />
          <Route path="/settings" element={<Settings />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
