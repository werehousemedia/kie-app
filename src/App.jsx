import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
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
import Tenants from '@/pages/Tenants';
import Finance from '@/pages/Finance';
import Maintenance from '@/pages/Maintenance';
import Contractors from '@/pages/Contractors';
import Compliance from '@/pages/Compliance';
import Activity from '@/pages/Activity';
import Integrations from '@/pages/Integrations';

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
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return (
    <Routes>
      <Route element={<ProtectedRoute unauthenticatedElement={null} />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Overview />} />
          <Route path="/whatsapp" element={<WhatsAppAssistant />} />
          <Route path="/properties" element={<Properties />} />
          <Route path="/tenants" element={<Tenants />} />
          <Route path="/finance" element={<Finance />} />
          <Route path="/maintenance" element={<Maintenance />} />
          <Route path="/contractors" element={<Contractors />} />
          <Route path="/compliance" element={<Compliance />} />
          <Route path="/activity" element={<Activity />} />
          <Route path="/integrations" element={<Integrations />} />
        </Route>
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App