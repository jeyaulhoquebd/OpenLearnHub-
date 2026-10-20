import { AlertTriangle, Info, Link2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  REASON_BADGE_STYLES,
  REASON_LABELS,
  reasonGroup
} from './reportMeta';

const ICONS = {
  illegal: AlertTriangle,
  broken: Link2,
  other: Info
};

/** Exact report reason pill; legal issues are always rose/“priority”. */
export default function ReportReasonBadge({ reason, className = '' }) {
  const { t } = useTranslation();
  const group = reasonGroup(reason);
  const Icon = ICONS[group];

  return (
    <span className={`chip ${REASON_BADGE_STYLES[group]} ${className}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {t(REASON_LABELS[reason] || 'report.reasons.other')}
    </span>
  );
}
