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
import GroupingSkills from "./pages/GroupingSkills";
import GroupingPS from "./pages/GroupingPS";
import GroupingReflections from "./pages/GroupingReflections";
import GroupingNotes from "./pages/GroupingNotes";
import GroupingSessions from "./pages/GroupingSessions";
import GroupingHabits from "./pages/GroupingHabits";
import GroupingTodos from "./pages/GroupingTodos";
import GroupingLeaderboard from "./pages/GroupingLeaderboard";
import GroupingPointManagement from "./pages/GroupingPointManagement";
import GroupingMarketplace from "./pages/GroupingMarketplace";
import PBLDashboard from "./pages/PBLDashboard";
import PBLProjects from "./pages/PBLProjects";
import PBLAnalytics from "./pages/PBLAnalytics";
import ProjectDetail from "./pages/ProjectDetail";
import PBLDocumentation from "./pages/PBLDocumentation";
import PBLNotifications from "./pages/PBLNotifications";
import PBLMySpace from "./pages/PBLMySpace";
import PBLTodos from "./pages/PBLTodos";
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
              <Route path="/grouping/skills" element={<GroupingSkills />} />
              <Route path="/grouping/ps" element={<GroupingPS />} />
              <Route path="/grouping/reflections" element={<GroupingReflections />} />
              <Route path="/grouping/notes" element={<GroupingNotes />} />
              <Route path="/grouping/sessions" element={<GroupingSessions />} />
              <Route path="/grouping/habits" element={<GroupingHabits />} />
              <Route path="/grouping/todos" element={<GroupingTodos />} />
              <Route path="/grouping/leaderboard" element={<GroupingLeaderboard />} />
              <Route path="/grouping/management/points" element={<GroupingPointManagement />} />
              <Route path="/grouping/marketplace" element={<GroupingMarketplace />} />
              {/* PBL Mode Routes */}
              <Route path="/pbl/dashboard" element={<PBLDashboard />} />
              <Route path="/pbl/my-space" element={<PBLMySpace />} />
              <Route path="/pbl/projects" element={<PBLProjects />} />
              <Route path="/pbl/projects/:projectId" element={<ProjectDetail />} />
              <Route path="/pbl/analytics" element={<PBLAnalytics />} />
              <Route path="/pbl/docs" element={<PBLDocumentation />} />
              <Route path="/pbl/notifications" element={<PBLNotifications />} />
              <Route path="/pbl/todos" element={<PBLTodos />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </AppModeProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
