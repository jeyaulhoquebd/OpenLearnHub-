import { useTranslation } from 'react-i18next';
import {
  CheckCircle2,
  Clock3,
  CornerUpRight,
  MinusCircle,
  XCircle
} from 'lucide-react';

const META = {
  ok: {
    icon: CheckCircle2,
    style:
      'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30'
  },
  redirected: {
    icon: CornerUpRight,
    style:
      'bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/30'
  },
  broken: {
    icon: XCircle,
    style:
      'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/30'
  },
  timeout: {
    icon: Clock3,
    style:
      'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/30'
  },
  skipped: {
    icon: MinusCircle,
    style: 'bg-sand-100 text-ink-muted ring-sand-300'
  },
  never: {
    icon: MinusCircle,
    style: 'bg-sand-100 text-ink-muted ring-sand-300'
  }
};

/** OK / redirected / broken / timeout / never pill for the link checker. */
export default function LinkStatusBadge({ status, className = '' }) {
  const { t } = useTranslation();
  const key = META[status] ? status : 'never';
  const { icon: Icon, style } = META[key];

  return (
    <span className={`chip ${style} ${className}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {t(`admin.linkChecker.status.${key}`)}
    </span>
  );
}
