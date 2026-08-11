import { useEffect, useState, ReactNode, lazy, Suspense } from "react";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation, useNavigate, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { AppModeProvider } from "@/hooks/useAppMode";
import { PWAInstallPrompt } from "@/components/pwa/PWAInstallPrompt";
import { SuspensionScreen } from "@/components/auth/SuspensionScreen";
import { AppLoadingScreen } from "@/components/common/AppLoadingScreen";
import { initNativePush, setPushNavigationHandler } from "./lib/push";

// Critical paths — eagerly loaded for fast first paint
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

// All other pages — lazy loaded for code splitting
const Team = lazy(() => import("./pages/Team"));
const MySpace = lazy(() => import("./pages/MySpace"));
const MemberProfile = lazy(() => import("./pages/MemberProfile"));
const MemberPublicProfile = lazy(() => import("./pages/MemberPublicProfile"));
const ProfileSettingsPage = lazy(() => import("./pages/ProfileSettingsPage"));
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
const GroupingIncharge = lazy(() => import("./pages/GroupingIncharge"));
const GroupingCalendar = lazy(() => import("./pages/GroupingCalendar"));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage"));
const PBLDashboard = lazy(() => import("./pages/PBLDashboard"));
const PBLProjects = lazy(() => import("./pages/PBLProjects"));
const PBLAnalytics = lazy(() => import("./pages/PBLAnalytics"));
const ProjectDetail = lazy(() => import("./pages/ProjectDetail"));
const PBLDocumentation = lazy(() => import("./pages/PBLDocumentation"));
const PBLNotifications = lazy(() => import("./pages/PBLNotifications"));
const PBLMySpace = lazy(() => import("./pages/PBLMySpace"));
const PBLTodos = lazy(() => import("./pages/PBLTodos"));
const PBLPolls = lazy(() => import("./pages/PBLPolls"));

// Route-level loading fallback
function RouteFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  );
}


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
function NativePushBootstrap() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    setPushNavigationHandler((path) => {
      navigate(path);
    });
  }, [navigate]);

  useEffect(() => {
    if (user) initNativePush();
  }, [user]);

  return null;
}

function ProtectedRouteGate({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  const publicPaths = ['/auth', '/', '/index.html'];
  const isPublic = publicPaths.includes(location.pathname);

  if (isLoading) {
    return <>{children}</>;
  }

  if (!user && !isPublic) {
    return <Navigate to="/auth" replace state={{ from: location }} />;
  }

  return <>{children}</>;
}

function SuspensionGate({ children }: { children: ReactNode }) {
  const { isDisabled, disabledMode, isLoading } = useAuth();
  const location = useLocation();
  const [continueReadOnly, setContinueReadOnly] = useState(false);

  // Always allow /auth to render (so the suspended user can sign out cleanly)
  if (isLoading) return <>{children}</>;
  if (location.pathname === '/auth' || location.pathname === '/' || location.pathname === '/index.html') return <>{children}</>;
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

function AppLoadingBootstrap() {
  const { isLoading } = useAuth();
  return <AppLoadingScreen isLoading={isLoading} />;
}

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey="teams-krypton-theme">
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AuthProvider>
          <AppLoadingBootstrap />
          <AppModeProvider>
            <PWAInstallPrompt />
            <BrowserRouter>
              <NativePushBootstrap />
              <ProtectedRouteGate>
                <SuspensionGate>
                  <Suspense fallback={<RouteFallback />}>
                    <Routes>
                    <Route path="/" element={<Index />} />
                    <Route path="/index.html" element={<Index />} />
                    <Route path="/auth" element={<Auth />} />
                    <Route path="/team" element={<Team />} />
                    <Route path="/my-space" element={<MySpace />} />
                    <Route path="/member/:userId" element={<MemberProfile />} />
                    <Route path="/profile/:userId" element={<MemberPublicProfile />} />
                    <Route path="/profile/settings" element={<ProfileSettingsPage />} />
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
                    <Route path="/grouping/incharge" element={<GroupingIncharge />} />
                    <Route path="/grouping/calendar" element={<GroupingCalendar />} />
                    <Route path="/grouping/notifications" element={<NotificationsPage />} />
                    <Route path="/notifications" element={<NotificationsPage />} />
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
                  </Suspense>
                </SuspensionGate>
              </ProtectedRouteGate>
            </BrowserRouter>
          </AppModeProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
