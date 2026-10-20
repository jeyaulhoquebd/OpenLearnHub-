/**
 * Shared metadata for the reports queue (badges, filters, board columns).
 * Reason labels come from the public `report.reasons.*` namespace so the
 * wording matches the "Report this resource" form.
 */

export const REPORT_STATUSES = ['open', 'in_review', 'resolved', 'dismissed'];

export const REASON_FILTERS = ['illegal', 'broken', 'other'];

export const REASON_LABELS = {
  copyright: 'report.reasons.copyright',
  'broken-link': 'report.reasons.brokenLink',
  piracy: 'report.reasons.piracy',
  inaccurate: 'report.reasons.inaccurate',
  spam: 'report.reasons.spam',
  other: 'report.reasons.other'
};

export function isIllegalReason(reason) {
  return reason === 'copyright' || reason === 'piracy';
}

export function reasonGroup(reason) {
  if (isIllegalReason(reason)) return 'illegal';
  if (reason === 'broken-link') return 'broken';
  return 'other';
}

/** Rose for legal issues, amber for dead links, sand for the rest. */
export const REASON_BADGE_STYLES = {
  illegal:
    'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/30',
  broken:
    'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/30',
  other: 'bg-sand-100 text-ink-soft ring-sand-300'
};

/** Column accent used by the Kanban headers. */
export const STATUS_ACCENTS = {
  open: 'border-t-rose-400',
  in_review: 'border-t-amber-400',
  resolved: 'border-t-brand-400',
  dismissed: 'border-t-sand-400'
};
