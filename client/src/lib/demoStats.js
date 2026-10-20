/**
 * Preview-only dashboard payload.
 *
 * The admin dashboard normally reads `GET /api/admin/stats`. Offline preview
 * builds have no API server and no Firebase session, so this module fabricates
 * a small, deterministic dataset from the demo library to keep the layout
 * testable. It is never used for a signed-in admin (AdminRoute guarantees a
 * user in production).
 */

const DAY_MS = 24 * 60 * 60 * 1000;

function dayKey(offset) {
  const now = new Date();
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return new Date(start - offset * DAY_MS).toISOString().slice(0, 10);
}

/** Tiny seeded LCG so the preview looks the same on every reload. */
function createRandom(seed = 424242) {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

function series(days, min, max, random) {
  const entries = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    entries.push({ date: dayKey(offset), count: 0 });
  }
  entries.forEach((entry) => {
    entry.count = min + Math.floor(random() * (max - min + 1));
  });
  return entries;
}

function countType(resources, type) {
  return resources.filter((resource) => resource.type === type).length;
}

function topBy(resources, field) {
  return [...resources]
    .sort((a, b) => (Number(b[field]) || 0) - (Number(a[field]) || 0))
    .slice(0, 5)
    .map((resource) => ({
      id: resource.id,
      title: resource.title,
      type: resource.type,
      thumbnailUrl: resource.thumbnailUrl || null,
      sourceName: resource.sourceName,
      status: resource.status || 'published',
      viewCount: Number(resource.viewCount) || 0,
      saveCount: Number(resource.saveCount) || 0
    }));
}

export function buildDemoStats(resources = []) {
  const random = createRandom();
  const users = series(30, 2, 11, random);
  const newResources = series(30, 0, 3, random);
  const recent = resources.slice(0, 3);

  const resourcesByType = {
    course: countType(resources, 'course'),
    book: countType(resources, 'book'),
    software: countType(resources, 'software')
  };

  const trends = {
    windowDays: 7,
    resources: newResources.slice(-7).reduce((sum, entry) => sum + entry.count, 0),
    courses: countType(recent, 'course'),
    books: countType(recent, 'book'),
    software: countType(recent, 'software'),
    users: users.slice(-7).reduce((sum, entry) => sum + entry.count, 0),
    reports: 2
  };

  const latestReports = recent.slice(0, 2).map((resource, index) => ({
    id: `demo-report-${index}`,
    resourceId: resource.id,
    resourceTitle: resource.title,
    reason: index === 0 ? 'broken_link' : 'copyright',
    details: '',
    status: 'open',
    reporterEmail: null,
    verifiedReporter: false,
    createdAt: new Date(Date.now() - (index + 1) * 6 * 60 * 60 * 1000).toISOString()
  }));

  const reviewers = ['Ayesha R.', 'Rahim K.', 'Nadia S.'];
  const comments = [
    'Clear explanations and a sensible pace — a great starting point.',
    'Excellent free material. The exercises at the end really help.',
    'Useful reference, though some sections assume prior experience.'
  ];

  const latestReviews = recent.map((resource, index) => ({
    id: `demo-review-${index}`,
    resourceId: resource.id,
    resourceTitle: resource.title,
    rating: 5 - index,
    body: comments[index % comments.length],
    authorName: reviewers[index % reviewers.length],
    createdAt: new Date(Date.now() - (index + 1) * 9 * 60 * 60 * 1000).toISOString()
  }));

  return {
    generatedAt: new Date().toISOString(),
    cached: false,
    totals: {
      resources: resources.length,
      resourcesByType,
      resourcesByStatus: {
        published: resources.length,
        pending: 2,
        draft: 0,
        rejected: 0,
        flagged: 1
      },
      users: 248,
      reviews: 96,
      bookmarks: 431,
      pendingReports: latestReports.length,
      flaggedResources: 1
    },
    trends,
    newUsersLast30Days: users,
    newResourcesLast30Days: newResources,
    topViewedResources: topBy(resources, 'viewCount'),
    topSavedResources: topBy(resources, 'saveCount'),
    latestReports,
    latestReviews,
    providers: {
      password: 128,
      'google.com': 74,
      'github.com': 27,
      'apple.com': 12,
      other: 7
    },
    usersScanned: 248,
    usersApproximate: false
  };
}
