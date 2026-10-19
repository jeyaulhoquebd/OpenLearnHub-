import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LayoutDashboard, LogOut, ShieldCheck, UserRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { initials } from '../lib/utils';

export default function UserMenu() {
  const { user, profile, isAdmin, signOut } = useAuth();
  const { push } = useToast();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    function handleClick(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  if (!user) return null;

  const displayName = profile?.displayName || user.displayName || user.email || 'Learner';
  const photoURL = profile?.photoURL || user.photoURL;

  async function handleSignOut() {
    setOpen(false);
    await signOut();
    push(t('auth.signOutToast'), { type: 'info' });
    navigate('/');
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-2 rounded-full border border-sand-300 bg-surface p-1 pe-3 text-sm font-semibold text-ink shadow-sm transition hover:border-brand-300"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {photoURL ? (
          <img src={photoURL} alt="" className="h-8 w-8 rounded-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <span className="grid h-8 w-8 place-items-center rounded-full bg-navy-800 text-xs font-bold text-white">
            {initials(displayName)}
          </span>
        )}
        <span className="hidden max-w-[7rem] truncate lg:block">{displayName.split(' ')[0]}</span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute end-0 mt-2 w-64 origin-top overflow-hidden rounded-2xl border border-sand-200 bg-surface p-2 shadow-float animate-fade-up"
        >
          <div className="border-b border-sand-100 px-3 py-2.5">
            <p className="truncate text-sm font-semibold text-ink">{displayName}</p>
            <p className="truncate text-xs text-ink-muted">{user.email}</p>
          </div>
          <Link
            to="/dashboard"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="mt-1 flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-ink-soft transition hover:bg-sand-100 hover:text-ink"
          >
            <LayoutDashboard className="h-4 w-4" />
            {t('nav.dashboard')}
          </Link>
          {isAdmin && (
            <Link
              to="/admin"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-ink-soft transition hover:bg-sand-100 hover:text-ink"
            >
              <ShieldCheck className="h-4 w-4" />
              {t('nav.admin')}
            </Link>
          )}
          <Link
            to="/dashboard?tab=profile"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-ink-soft transition hover:bg-sand-100 hover:text-ink"
          >
            <UserRound className="h-4 w-4" />
            {t('dashboard.profile')}
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={handleSignOut}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-start text-sm font-medium text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
          >
            <LogOut className="h-4 w-4" />
            {t('common.signOut')}
          </button>
        </div>
      )}
    </div>
  );
}
