import { Toaster } from "@/components/ui/toaster"
import { Toaster as SonnerToaster } from "@/components/ui/sonner"
import { ThemeProvider } from "next-themes"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from '@/components/ProtectedRoute';
import AppLayout from '@/components/layout/AppLayout';
import Overview from '@/pages/Overview';
import WhatsAppAssistant from '@/pages/WhatsAppAssistant';
import Properties from '@/pages/Properties';
import PropertyDetail from '@/pages/PropertyDetail';
import Tenants from '@/pages/Tenants';
import TenantProfile from '@/pages/TenantProfile';
import Finance from '@/pages/Finance';
import Maintenance from '@/pages/Maintenance';
import Contractors from '@/pages/Contractors';
import Compliance from '@/pages/Compliance';
import Activity from '@/pages/Activity';
import Integrations from '@/pages/Integrations';
import ImportWizard from '@/pages/ImportWizard';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import OAuthConsent from '@/pages/OAuthConsent';

// Auth pages live outside the protected group; never bounce to login from them.
const AUTH_PATHS = ['/login', '/register', '/forgot-password', '/reset-password', '/oauth-consent'];
const onAuthPage = () => AUTH_PATHS.some((p) => window.location.pathname.startsWith(p));

// Visiting the published app without a session used to dead-end on a blank
// page: authChecked + !isAuthenticated + no authError fell through to
// unauthenticatedElement={null}. Redirect to the Base44 login instead.
const RedirectToLogin = () => {
  const { navigateToLogin } = useAuth();
  useEffect(() => { navigateToLogin(); }, [navigateToLogin]);
  return (
    <div className="fixed inset-0 flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
    </div>
  );
};

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required' && !onAuthPage()) {
      navigateToLogin();
      return null;
    }
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/oauth-consent" element={<OAuthConsent />} />
      <Route element={<ProtectedRoute unauthenticatedElement={<RedirectToLogin />} />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Overview />} />
          <Route path="/whatsapp" element={<WhatsAppAssistant />} />
          <Route path="/properties" element={<Properties />} />
          <Route path="/properties/:id" element={<PropertyDetail />} />
          <Route path="/tenants" element={<Tenants />} />
          <Route path="/tenants/:id" element={<TenantProfile />} />
          <Route path="/finance" element={<Finance />} />
          <Route path="/maintenance" element={<Maintenance />} />
          <Route path="/contractors" element={<Contractors />} />
          <Route path="/compliance" element={<Compliance />} />
          <Route path="/activity" element={<Activity />} />
          <Route path="/integrations" element={<Integrations />} />
          <Route path="/import" element={<ImportWizard />} />
        </Route>
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <AuthProvider>
        <QueryClientProvider client={queryClientInstance}>
          <Router>
            <ScrollToTop />
            <AuthenticatedApp />
          </Router>
          <Toaster />
          {/* Pages toast via sonner — its Toaster was never mounted, so every
              success/error confirmation in the app was silently invisible. */}
          <SonnerToaster position="top-right" richColors closeButton />
        </QueryClientProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App