import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Sparkles, X } from 'lucide-react';
import ChatPanel from './ChatPanel';

export default function AiAssistant() {
  const { t } = useTranslation();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  if (location.pathname.startsWith('/assistant')) return null;

  return (
    <>
      {open && (
        <div className="fixed inset-x-3 bottom-3 z-[100] sm:inset-x-auto sm:end-6 sm:bottom-6 sm:w-[24rem]">
          <div className="overflow-hidden rounded-3xl border border-sand-200 bg-surface shadow-float">
            <ChatPanel variant="widget" onClose={() => setOpen(false)} />
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={`fixed bottom-5 end-5 z-[95] inline-flex items-center gap-2 rounded-full bg-navy-900 py-3.5 text-sm font-semibold text-white shadow-float transition hover:bg-navy-800 active:scale-95 ${
          open ? 'px-3.5' : 'ps-4 pe-5'
        }`}
        aria-expanded={open}
        aria-label={t('assistant.fab')}
      >
        {open ? <X className="h-5 w-5" /> : <Sparkles className="h-5 w-5 text-navy-300" />}
        {!open && <span className="hidden sm:inline">{t('assistant.fab')}</span>}
      </button>
    </>
  );
}
