import { getSiteSettings } from '../lib/siteSettings.js';
import { apiError } from '../lib/http.js';
import { optionalAuth } from './auth.js';

/**
 * Maintenance mode used to be enforced only by the public layout. This guard
 * applies the same switch to the public write/AI endpoints. Administrators
 * (admin custom claim) keep access so they can test while the site is closed.
 */
export async function blockDuringMaintenance(req, res, next) {
  let settings;
  try {
    settings = await getSiteSettings();
  } catch {
    return next();
  }
  if (!settings?.maintenanceMode) return next();

  return optionalAuth(req, res, () => {
    if (req.user?.admin === true) return next();
    return apiError(
      res,
      503,
      'maintenance',
      'OpenLearn Hub is undergoing maintenance. Please try again soon.'
    );
  });
}
