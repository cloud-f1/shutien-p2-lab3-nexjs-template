import { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import SignInPage from "./pages/auth/SignInPage";
import SignUpPage from "./pages/auth/SignUpPage";
import ForgotPasswordPage from "./pages/auth/ForgotPasswordPage";
import ResetPasswordPage from "./pages/auth/ResetPasswordPage";
import VerifyEmailPage from "./pages/auth/VerifyEmailPage";
import OAuthCallbackPage from "./pages/auth/OAuthCallbackPage";
import DashboardLayout from "./components/DashboardLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./components/ThemeProvider";
import { ToastProvider } from "./components/ui";
import SkipNav from "./components/SkipNav";
import { useFocusOnNavigate } from "./hooks/useFocusOnNavigate";
import PrivacyPage from "./pages/legal/PrivacyPage";
import TermsPage from "./pages/legal/TermsPage";
import GettingStartedPage from "./pages/getting-started/GettingStartedPage";
import NotFoundPage from "./pages/NotFoundPage";
import { ROUTE_MAP, VIEW_ORDER } from "./config/routeMap";
import { useAuthStore } from "./store/authStore";

function AppRoutes() {
  useFocusOnNavigate();
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/signin" element={<SignInPage />} />
      <Route path="/signup" element={<SignUpPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/auth/callback" element={<OAuthCallbackPage />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        {/* Default: redirect /dashboard to /dashboard/overview */}
        <Route index element={<Navigate to="overview" replace />} />
        {/* Generate child routes from ROUTE_MAP */}
        {VIEW_ORDER.map((id) => {
          const entry = ROUTE_MAP[id];
          const Component = entry.component;
          return (
            <Route
              key={id}
              path={entry.path}
              element={<Component />}
            />
          );
        })}
      </Route>
      <Route path="/getting-started" element={<GettingStartedPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

function App() {
  const restoreSession = useAuthStore((s) => s.restoreSession);

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ToastProvider>
          <SkipNav />
          <AppRoutes />
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
