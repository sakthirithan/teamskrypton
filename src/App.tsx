import { useEffect, useState, ReactNode, lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { AppModeProvider } from "@/hooks/useAppMode";
import { PWAInstallPrompt } from "@/components/pwa/PWAInstallPrompt";
import { SuspensionScreen } from "@/components/auth/SuspensionScreen";
import { initNativePush } from "@/lib/push";

// Eager: entry routes needed on first paint
import Index from "./pages/Index";
import Auth from "./pages/Auth";

// Lazy: everything else is split per-route to shrink the initial bundle
const Team = lazy(() => import("./pages/Team"));
const MySpace = lazy(() => import("./pages/MySpace"));
const MemberProfile = lazy(() => import("./pages/MemberProfile"));
const MemberPublicProfile = lazy(() => import("./pages/MemberPublicProfile"));
const GroupingHome = lazy(() => import("./pages/GroupingHome"));
const GroupingMe = lazy(() => import("./pages/GroupingMe"));
const GroupingSkills = lazy(() => import("./pages/GroupingSkills"));
const GroupingPS = lazy(() => import("./pages/GroupingPS"));
const GroupingReflections = lazy(() => import("./pages/GroupingReflections"));
const GroupingNotes = lazy(() => import("./pages/GroupingNotes"));
const GroupingSessions = lazy(() => import("./pages/GroupingSessions"));
const GroupingHabits = lazy(() => import("./pages/GroupingHabits"));
const GroupingTodos = lazy(() => import("./pages/GroupingTodos"));
const GroupingLeaderboard = lazy(() => import("./pages/GroupingLeaderboard"));
const GroupingPointManagement = lazy(() => import("./pages/GroupingPointManagement"));
const GroupingPolls = lazy(() => import("./pages/GroupingPolls"));
const PBLDashboard = lazy(() => import("./pages/PBLDashboard"));
const PBLProjects = lazy(() => import("./pages/PBLProjects"));
const PBLAnalytics = lazy(() => import("./pages/PBLAnalytics"));
const ProjectDetail = lazy(() => import("./pages/ProjectDetail"));
const PBLDocumentation = lazy(() => import("./pages/PBLDocumentation"));
const PBLNotifications = lazy(() => import("./pages/PBLNotifications"));
const PBLMySpace = lazy(() => import("./pages/PBLMySpace"));
const PBLTodos = lazy(() => import("./pages/PBLTodos"));
const PBLPolls = lazy(() => import("./pages/PBLPolls"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000,
      gcTime: 15 * 60 * 1000,
      retry: 1,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: true,
structuralSharing: true,
    },
  },
});

function RouteFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 rounded-full border-2 border-primary/25 border-t-primary animate-spin" />
        <p className="text-xs text-muted-foreground">Loading…</p>
      </div>
    </div>
  );
}

function NativePushBootstrap() {
  const { user } = useAuth();
  useEffect(() => { if (user) initNativePush(); }, [user]);
  return null;
}

function SuspensionGate({ children }: { children: ReactNode }) {
  const { isDisabled, disabledMode, isLoading } = useAuth();
  const location = useLocation();
  const [continueReadOnly, setContinueReadOnly] = useState(false);

  // Always allow /auth to render (so the suspended user can sign out cleanly)
  if (isLoading) return <>{children}</>;
  if (location.pathname === '/auth') return <>{children}</>;
  if (!isDisabled) return <>{children}</>;

  // Read-only mode: user may opt to continue into the app in view-only.
  if (disabledMode === 'read_only' && continueReadOnly) {
    return <>{children}</>;
  }

  return (
    <SuspensionScreen
      onContinueReadOnly={disabledMode === 'read_only' ? () => setContinueReadOnly(true) : undefined}
    />
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <AppModeProvider>
          <NativePushBootstrap />
          <PWAInstallPrompt />
          <BrowserRouter>
            <SuspensionGate>
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
                <Route path="/grouping/polls" element={<GroupingPolls />} />
                {/* PBL Mode Routes */}
                <Route path="/pbl/dashboard" element={<PBLDashboard />} />
                <Route path="/pbl/my-space" element={<PBLMySpace />} />
                <Route path="/pbl/projects" element={<PBLProjects />} />
                <Route path="/pbl/projects/:projectId" element={<ProjectDetail />} />
                <Route path="/pbl/analytics" element={<PBLAnalytics />} />
                <Route path="/pbl/docs" element={<PBLDocumentation />} />
                <Route path="/pbl/notifications" element={<PBLNotifications />} />
                <Route path="/pbl/todos" element={<PBLTodos />} />
                <Route path="/pbl/polls" element={<PBLPolls />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </SuspensionGate>
          </BrowserRouter>
        </AppModeProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
