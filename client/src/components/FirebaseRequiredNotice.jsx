import { AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function FirebaseRequiredNotice() {
  const { t } = useTranslation();
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-500/30 dark:bg-amber-500/10">
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-300" />
        <div>
          <p className="font-semibold text-amber-900 dark:text-amber-200">{t('auth.configTitle')}</p>
          <p className="mt-1 leading-relaxed text-amber-900 dark:text-amber-200">{t('auth.configText')}</p>
        </div>
      </div>
    </div>
  );
}
