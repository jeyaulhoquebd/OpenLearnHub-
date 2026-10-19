import { AlertTriangle, Info, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { missingFirebaseVars } from '../lib/firebase';

export default function ConfigBanner() {
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem('openlearn.configBanner') === 'dismissed'
  );
  const [showDetails, setShowDetails] = useState(false);

  if (dismissed) return null;

  return (
    <div className="border-b border-amber-200 bg-amber-50/90">
      <div className="container-page flex flex-col gap-2 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2.5">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p className="text-amber-900">
            <span className="font-semibold">{t('config.previewTitle')}:</span> {t('config.previewText')}
          </p>
        </div>
        <div className="flex items-center gap-2 ps-6 sm:ps-0">
          <button
            type="button"
            onClick={() => setShowDetails((value) => !value)}
            className="inline-flex items-center gap-1 text-xs font-semibold text-amber-800 underline underline-offset-2"
          >
            <Info className="h-3.5 w-3.5" />
            {showDetails ? 'Hide' : 'Details'}
          </button>
          <button
            type="button"
            onClick={() => {
              sessionStorage.setItem('openlearn.configBanner', 'dismissed');
              setDismissed(true);
            }}
            className="grid h-7 w-7 place-items-center rounded-full text-amber-700 transition hover:bg-amber-100"
            aria-label={t('config.dismiss')}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      {showDetails && (
        <div className="container-page pb-3">
          <p className="rounded-xl bg-white/70 px-3 py-2 font-mono text-xs text-amber-900">
            Missing: {missingFirebaseVars.join(', ')}
          </p>
        </div>
      )}
    </div>
  );
}
