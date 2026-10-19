import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Menu, Plus, Sparkles, X } from 'lucide-react';
import Logo from './Logo';
import LanguageSwitcher from './LanguageSwitcher';
import UserMenu from './UserMenu';
import { useAuth } from '../context/AuthContext';

export default function Header() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
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
        className="absolute -top-16 start-4 z-[60] rounded-full bg-brand-900 px-4 py-2 text-xs font-semibold text-white transition focus:top-3"
      >
        Skip to content
      </a>
      <div className="container-page flex h-16 items-center justify-between gap-4 lg:h-[4.5rem]">
        <Logo />

        <nav className="hidden items-center gap-0.5 xl:flex" aria-label="Primary">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={linkClass}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden items-center gap-2.5 xl:flex">
          <LanguageSwitcher />
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
          <LanguageSwitcher compact />
          {user && <UserMenu />}
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="grid h-10 w-10 place-items-center rounded-full border border-sand-300 bg-white text-ink shadow-sm"
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? t('common.close') : t('nav.menu')}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div id="mobile-menu" className="border-t border-sand-200 bg-white xl:hidden">
          <nav className="container-page flex flex-col gap-1 py-4" aria-label="Mobile">
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
          </nav>
        </div>
      )}
    </header>
  );
}
