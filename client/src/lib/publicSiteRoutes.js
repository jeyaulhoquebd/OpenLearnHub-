const PUBLIC_SITE_PATHS = new Set([
  '/',
  '/explore',
  '/courses',
  '/books',
  '/software',
  '/search',
  '/assistant',
  '/dashboard',
  '/signup',
  '/login',
  '/forgot-password',
  '/submit',
  '/about',
  '/contact',
  '/legal/copyright',
  '/legal/terms',
  '/legal/privacy'
]);

export function isPublicSitePath(path) {
  return PUBLIC_SITE_PATHS.has(path);
}
