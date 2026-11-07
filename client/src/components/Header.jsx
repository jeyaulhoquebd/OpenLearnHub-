import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Menu, Plus, Search, ShieldCheck, Sparkles, X } from 'lucide-react';
import Logo from './Logo';
import LanguageSwitcher from './LanguageSwitcher';
import ThemeToggle from './ThemeToggle';
import UserMenu from './UserMenu';
import { useAuth } from '../context/AuthContext';

export default function Header() {
  const { t } = useTranslation();
  const { user, isAdmin } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 8);
    }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const navItems = [
    { to: '/', label: t('nav.home'), end: true },
    { to: '/explore', label: t('nav.explore') },
    { to: '/courses', label: t('nav.courses') },
    { to: '/books', label: t('nav.books') },
    { to: '/software', label: t('nav.software') },
    { to: '/assistant', label: t('nav.assistant') },
    { to: '/about', label: t('nav.about') }
  ];

  const linkClass = ({ isActive }) =>
    `rounded-full px-3.5 py-2 text-sm font-semibold transition ${
      isActive ? 'bg-brand-50 text-brand-800' : 'text-ink-soft hover:bg-sand-100 hover:text-ink'
    }`;

  return (
    <header
      className={`sticky top-0 z-50 border-b transition ${
        scrolled ? 'border-sand-200 bg-sand-50/90 shadow-sm backdrop-blur-md' : 'border-transparent bg-sand-50/80 backdrop-blur'
      }`}
    >
      <a
        href="#main"
        className="absolute -top-16 start-4 z-[60] rounded-full bg-navy-900 px-4 py-2 text-xs font-semibold text-white transition focus:top-3"
      >
        {t('common.skipToContent')}
      </a>
      <div className="container-page flex h-16 items-center justify-between gap-4 lg:h-[4.5rem]">
        <Logo />

        <nav className="hidden items-center gap-0.5 xl:flex" aria-label={t('nav.primary')}>
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={linkClass}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden items-center gap-2.5 xl:flex">
          <Link
            to="/search"
            className="grid h-10 w-10 place-items-center rounded-full border border-sand-300 bg-surface text-ink-soft shadow-sm transition hover:border-brand-300 hover:text-brand-800"
            aria-label={t('common.search')}
            title={t('common.search')}
          >
            <Search className="h-4 w-4" />
          </Link>
          <ThemeToggle />
          <LanguageSwitcher />
          {/* Only administrators ever see this link. */}
          {isAdmin && (
            <Link
              to="/admin"
              className="inline-flex items-center gap-1.5 rounded-full border border-accent-200 bg-accent-50 px-3 py-1.5 text-xs font-bold text-accent-700 transition hover:border-accent-400 hover:bg-accent-100 dark:border-accent-500/40 dark:bg-accent-500/10 dark:text-accent-200 dark:hover:bg-accent-500/20"
            >
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              {t('nav.admin')}
            </Link>
          )}
          {user ? (
            <>
              <Link to="/submit" className="btn-secondary btn-sm">
                <Plus className="h-4 w-4" />
                <span className="hidden 2xl:inline">{t('nav.submit')}</span>
                <span className="2xl:hidden">{t('common.submit')}</span>
              </Link>
              <UserMenu />
            </>
          ) : (
            <>
              <Link to="/login" className="btn-ghost btn-sm">
                {t('nav.login')}
              </Link>
              <Link to="/signup" className="btn-primary btn-sm">
                {t('nav.signup')}
              </Link>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 xl:hidden">
          <Link
            to="/search"
            className="grid h-10 w-10 place-items-center rounded-full border border-sand-300 bg-surface text-ink-soft shadow-sm"
            aria-label={t('common.search')}
            title={t('common.search')}
          >
            <Search className="h-4 w-4" />
          </Link>
          <ThemeToggle />
          <div className="hidden sm:block">
            <LanguageSwitcher compact />
          </div>
          {user && <UserMenu />}
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="grid h-10 w-10 place-items-center rounded-full border border-sand-300 bg-surface text-ink shadow-sm"
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? t('common.close') : t('nav.menu')}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div id="mobile-menu" className="border-t border-sand-200 bg-surface xl:hidden">
          <nav className="container-page flex flex-col gap-1 py-4" aria-label={t('nav.mobile')}>
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                    isActive ? 'bg-brand-50 text-brand-800' : 'text-ink-soft hover:bg-sand-100'
                  }`
                }
              >
                {item.label}
                {item.to === '/assistant' && <Sparkles className="h-4 w-4 text-brand-500" />}
              </NavLink>
            ))}
            <div className="mt-3 grid grid-cols-2 gap-2 border-t border-sand-100 pt-4">
              {user ? (
                <>
                  <Link to="/submit" className="btn-primary justify-center">
                    <Plus className="h-4 w-4" />
                    {t('common.submit')}
                  </Link>
                  <Link to="/dashboard" className="btn-secondary justify-center">
                    {t('nav.dashboard')}
                  </Link>
                  {isAdmin && (
                    <Link to="/admin" className="btn-secondary justify-center">
                      <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                      {t('nav.admin')}
                    </Link>
                  )}
                </>
              ) : (
                <>
                  <Link to="/login" className="btn-secondary justify-center">
                    {t('nav.login')}
                  </Link>
                  <Link to="/signup" className="btn-primary justify-center">
                    {t('nav.signup')}
                  </Link>
                </>
              )}
            </div>
            <div className="mt-4 flex items-center justify-between gap-3 border-t border-sand-100 pt-4 sm:hidden">
              <LanguageSwitcher />
              <ThemeToggle />
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
