import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Bookmark, BookmarkCheck, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { isBookmarked, removeBookmark, saveBookmark } from '../lib/data';

export default function BookmarkButton({ resource, className = '', labelPosition = 'icon' }) {
  const { user, firebaseReady } = useAuth();
  const { push } = useToast();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    if (!user || !resource?.id) {
      setSaved(false);
      return undefined;
    }
    isBookmarked(user.uid, resource.id)
      .then((value) => {
        if (active) setSaved(value);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [user, resource?.id]);

  async function handleToggle(event) {
    event.preventDefault();
    event.stopPropagation();

    if (!firebaseReady) {
      push(t('config.previewText'), { type: 'info' });
      return;
    }

    if (!user) {
      navigate('/login', { state: { from: `${window.location.pathname}${window.location.search}` } });
      push(t('resource.signInToSave'), { type: 'info' });
      return;
    }

    setBusy(true);
    try {
      if (saved) {
        await removeBookmark(user.uid, resource.id);
        setSaved(false);
        push(t('resource.removeSuccess'), { type: 'info' });
      } else {
        await saveBookmark(user.uid, resource.id);
        setSaved(true);
        push(t('resource.saveSuccess'));
      }
    } catch (error) {
      console.warn('[bookmark]', error);
      push(t('resource.saveError'), { type: 'error' });
    } finally {
      setBusy(false);
    }
  }

  const Icon = busy ? Loader2 : saved ? BookmarkCheck : Bookmark;

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-pressed={saved}
      aria-label={saved ? t('resource.saved') : t('resource.save')}
      title={saved ? t('resource.saved') : t('resource.save')}
      className={`inline-flex items-center gap-2 rounded-full border border-sand-300 bg-white px-3 py-2 text-xs font-semibold text-ink-soft shadow-sm transition hover:border-brand-300 hover:text-brand-800 ${className}`}
    >
      <Icon className={`h-4 w-4 ${busy ? 'animate-spin' : ''} ${saved ? 'text-brand-700' : ''}`} />
      {labelPosition === 'full' && <span>{saved ? t('resource.saved') : t('resource.save')}</span>}
    </button>
  );
}
