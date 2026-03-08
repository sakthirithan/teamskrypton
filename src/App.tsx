import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { AppModeProvider } from "@/hooks/useAppMode";
import { PWAInstallPrompt } from "@/components/pwa/PWAInstallPrompt";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Team from "./pages/Team";
import MySpace from "./pages/MySpace";
import MemberProfile from "./pages/MemberProfile";
import MemberPublicProfile from "./pages/MemberPublicProfile";
import GroupingHome from "./pages/GroupingHome";
import GroupingMe from "./pages/GroupingMe";
import PBLDashboard from "./pages/PBLDashboard";
import PBLProjects from "./pages/PBLProjects";
import PBLAnalytics from "./pages/PBLAnalytics";
import ProjectDetail from "./pages/ProjectDetail";
import PBLDocumentation from "./pages/PBLDocumentation";
import PBLNotifications from "./pages/PBLNotifications";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <AppModeProvider>
          <PWAInstallPrompt />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/team" element={<Team />} />
              <Route path="/my-space" element={<MySpace />} />
              <Route path="/member/:userId" element={<MemberProfile />} />
              <Route path="/profile/:userId" element={<MemberPublicProfile />} />
              {/* Grouping Mode Routes */}
              <Route path="/grouping/home" element={<GroupingHome />} />
              <Route path="/grouping/me" element={<GroupingMe />} />
              {/* PBL Mode Routes */}
              <Route path="/pbl/dashboard" element={<PBLDashboard />} />
              <Route path="/pbl/projects" element={<PBLProjects />} />
              <Route path="/pbl/projects/:projectId" element={<ProjectDetail />} />
              <Route path="/pbl/analytics" element={<PBLAnalytics />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </AppModeProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
