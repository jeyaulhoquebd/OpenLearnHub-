import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Compass, Home } from 'lucide-react';
import { usePageMeta } from '../hooks/usePageMeta';

export default function NotFoundPage() {
  const { t } = useTranslation();
  usePageMeta(t('notFound.title'));

  return (
    <section className="container-page section">
      <div className="card mx-auto max-w-xl overflow-hidden text-center">
        <div className="relative overflow-hidden bg-gradient-to-br from-brand-900 via-brand-800 to-brand-600 px-6 py-12 text-white">
          <div className="absolute inset-0 bg-grid opacity-15" />
          <div className="relative">
            <p className="font-display text-7xl font-semibold">404</p>
            <h1 className="mt-3 font-display text-2xl font-semibold">{t('notFound.title')}</h1>
          </div>
        </div>
        <div className="p-8">
          <p className="text-sm leading-relaxed text-ink-soft">{t('notFound.text')}</p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <Link to="/explore" className="btn-primary">
              <Compass className="h-4 w-4" />
              {t('notFound.button')}
            </Link>
            <Link to="/" className="btn-secondary">
              <Home className="h-4 w-4" />
              {t('common.home')}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
