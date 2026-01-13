import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { TestSessionProvider } from "@/contexts/TestSessionContext";
import { TestSessionBanner } from "@/components/test-session/TestSessionBanner";
import { PWAInstallPrompt } from "@/components/pwa/PWAInstallPrompt";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Team from "./pages/Team";
import MySpace from "./pages/MySpace";
import MemberProfile from "./pages/MemberProfile";
import MemberPublicProfile from "./pages/MemberPublicProfile";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <TestSessionProvider>
          <TestSessionBanner />
          <PWAInstallPrompt />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/team" element={<Team />} />
              <Route path="/my-space" element={<MySpace />} />
              <Route path="/member/:userId" element={<MemberProfile />} />
              <Route path="/profile/:userId" element={<MemberPublicProfile />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TestSessionProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
