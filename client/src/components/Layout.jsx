import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';
import AiAssistant from './AiAssistant';
import ConfigBanner from './ConfigBanner';
import { isFirebaseConfigured } from '../lib/firebase';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  }, [pathname]);
  return null;
}

export default function Layout() {
  return (
    <div className="flex min-h-screen flex-col">
      <ScrollToTop />
      <Header />
      {!isFirebaseConfigured && <ConfigBanner />}
      <main id="main" className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <AiAssistant />
    </div>
  );
}
