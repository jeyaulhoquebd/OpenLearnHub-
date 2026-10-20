import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';
import AiAssistant from './AiAssistant';
import AnnouncementBanner from './AnnouncementBanner';
import ConfigBanner from './ConfigBanner';
import MaintenancePage from '../pages/MaintenancePage';
import { isFirebaseConfigured } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { useSiteSettings } from '../context/SiteSettingsContext';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  }, [pathname]);
  return null;
}

export default function Layout() {
  const { settings } = useSiteSettings();
  const { isAdmin, loading: authLoading } = useAuth();

  // Keep the site reachable for administrators while the public is paused.
  if (settings.maintenanceMode && !authLoading && !isAdmin) {
    return <MaintenancePage />;
  }

  return (
    <div className="flex min-h-screen flex-col">
      <ScrollToTop />
      <Header />
      {!isFirebaseConfigured && <ConfigBanner />}
      <AnnouncementBanner />
      <main id="main" className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <AiAssistant />
    </div>
  );
}
