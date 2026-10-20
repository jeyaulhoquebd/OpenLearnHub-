/**
 * Shared helpers for the admin reports queue.
 *
 * Reports are created by the public `/api/reports` endpoint and may contain a
 * mix of legacy reasons (copyright, piracy, …) and newer ones. The admin UI
 * groups them into three filters — illegal, broken and other — while the card
 * still shows the exact reason. "Illegal" reports are always sorted first.
 */

export const REPORT_STATUSES = ['open', 'in_review', 'resolved', 'dismissed'];
export const REPORT_REASONS = [
  'copyright',
  'broken-link',
  'piracy',
  'inaccurate',
  'spam',
  'other'
];

export const REPORT_SCAN_LIMIT = 500;

/** Highest priority first: copyright/piracy → broken link → everything else. */
const SEVERITY = {
  copyright: 0,
  piracy: 0,
  'broken-link': 1,
  inaccurate: 2,
  spam: 3,
  other: 4
};

const REASON_GROUPS = {
  illegal: ['copyright', 'piracy'],
  broken: ['broken-link'],
  other: ['inaccurate', 'spam', 'other']
};

export function isIllegalReason(reason) {
  return REASON_GROUPS.illegal.includes(reason);
}

export function reasonGroup(reason) {
  if (REASON_GROUPS.illegal.includes(reason)) return 'illegal';
  if (REASON_GROUPS.broken.includes(reason)) return 'broken';
  return 'other';
}

export function reasonMatchesFilter(reason, filter) {
  if (!filter) return true;
  if (REASON_GROUPS[filter]) return REASON_GROUPS[filter].includes(reason);
  return reason === filter;
}

export function reportSeverity(reason) {
  return SEVERITY[reason] ?? 5;
}

export function toIso(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (value.seconds) return new Date(value.seconds * 1000).toISOString();
  return null;
}

export function timeOf(value) {
  const parsed = new Date(toIso(value) || 0).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

/** Compact resource summary attached to a report row. */
export function resourceSummary(snapshot) {
  if (!snapshot?.exists) return null;
  const data = snapshot.data() || {};
  return {
    id: snapshot.id,
    title: data.title || {},
    slug: data.slug || '',
    type: data.type || null,
    status: data.status || 'draft',
    sourceUrl: data.sourceUrl || ''
  };
}

/**
 * Normalises a report document for the admin API.
 *
 * @param {FirebaseFirestore.QueryDocumentSnapshot|FirebaseFirestore.DocumentSnapshot} snapshot
 * @param {{ resource?: object|null, similarCount?: number }} [context]
 */
export function serializeReport(snapshot, { resource = null, similarCount = 1 } = {}) {
  const data = snapshot.data() || {};
  const reason = data.reason || 'other';

  return {
    id: snapshot.id,
    resourceId: data.resourceId || null,
    // The report stores the title as it was at submission time; the resource
    // summary reflects the current title.
    resourceTitle: data.resourceTitle || '',
    resourceType: data.resourceType || null,
    resourceUrl: data.resourceUrl || '',
    reason,
    reasonGroup: reasonGroup(reason),
    illegal: isIllegalReason(reason),
    details: data.details || '',
    status: REPORT_STATUSES.includes(data.status) ? data.status : 'open',
    adminNote: data.adminNote || '',
    resolution: data.resolution || null,
    reporterUid: data.reporterUid || null,
    reporterEmail: data.reporterEmail || null,
    verifiedReporter: data.verifiedReporter === true,
    locale: data.locale || 'en',
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt),
    reviewedAt: toIso(data.reviewedAt),
    reviewedBy: data.reviewedBy || null,
    resource,
    similarCount: Math.max(1, Number(similarCount) || 1)
  };
}

/** Free-text haystack used by the search box. */
export function reportSearchText(report) {
  const title =
    typeof report.resourceTitle === 'object'
      ? Object.values(report.resourceTitle).join(' ')
      : report.resourceTitle;

  const resourceTitle = report.resource?.title
    ? typeof report.resource.title === 'object'
      ? Object.values(report.resource.title).join(' ')
      : report.resource.title
    : '';

  return [
    title,
    resourceTitle,
    report.details,
    report.reporterEmail,
    report.resourceId,
    report.adminNote,
    report.reason
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}
