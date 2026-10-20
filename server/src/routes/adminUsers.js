import { Router } from 'express';
import { z } from 'zod';
import { FieldValue } from 'firebase-admin/firestore';
import { getDb, getFirebaseAuth } from '../firebase.js';
import { apiError } from '../lib/http.js';
import { writeAuditLogForRequest } from '../lib/audit.js';
import { sanitizeEmail } from '../lib/validation.js';
import {
  PROVIDERS,
  USER_SCAN_LIMIT,
  countAdmins,
  countQuery,
  loadProfiles,
  scanAuthUsers,
  serializeAuthUser
} from '../lib/userAdmin.js';

/**
 * Admin users API.
 *
 * Identity comes from Firebase Auth; profile fields come from Firestore. All
 * privileged writes are audited, and two safety rules are enforced here (not
 * just in the UI):
 *   - an administrator can never remove their own admin claim;
 *   - the last remaining administrator can never be demoted or deleted.
 */

const listQuerySchema = z.object({
  pageToken: z.string().trim().max(2048).optional().default(''),
  search: z.string().trim().max(120).optional().default(''),
  limit: z.coerce.number().int().min(5).max(100).optional().default(25),
  verified: z.enum(['true', 'false']).optional(),
  provider: z.enum(PROVIDERS).optional(),
  admin: z.enum(['true', 'false']).optional(),
  disabled: z.enum(['true', 'false']).optional()
});

const deleteSchema = z.object({
  confirmEmail: z.string().trim().min(3).max(200)
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function boolParam(value) {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return null;
}

function requireAuth(res) {
  const auth = getFirebaseAuth();
  if (!auth) {
    apiError(res, 503, 'auth_unavailable', 'Firebase Auth is not configured.');
    return null;
  }
  return auth;
}

function parseQuery(res, raw) {
  const cleaned = { ...raw };
  Object.keys(cleaned).forEach((key) => {
    if (cleaned[key] === '') delete cleaned[key];
  });

  const parsed = listQuerySchema.safeParse(cleaned);
  if (!parsed.success) {
    apiError(res, 400, 'invalid_query', 'Those filters are not valid.');
    return null;
  }
  return parsed.data;
}

async function loadRecord(res, auth, uid) {
  if (!uid || uid.length > 128) {
    apiError(res, 400, 'invalid_uid', 'That account id is not valid.');
    return null;
  }

  try {
    return await auth.getUser(uid);
  } catch (error) {
    if (error?.code === 'auth/user-not-found') {
      apiError(res, 404, 'user_not_found', 'That account no longer exists.');
      return null;
    }
    throw error;
  }
}

function audit(req, action, uid, details = {}) {
  return writeAuditLogForRequest(req, {
    action,
    targetType: 'user',
    targetId: uid,
    details
  });
}

/** Deletes matching docs in batches of 400 (Firestore's write cap is 500). */
async function deleteMatching(db, collectionName, field, value) {
  const snapshot = await db.collection(collectionName).where(field, '==', value).get();
  if (snapshot.empty) return 0;

  let deleted = 0;
  for (let index = 0; index < snapshot.docs.length; index += 400) {
    const batch = db.batch();
    snapshot.docs.slice(index, index + 400).forEach((doc) => batch.delete(doc.ref));
    // eslint-disable-next-line no-await-in-loop
    await batch.commit();
    deleted += Math.min(400, snapshot.docs.length - index);
  }
  return deleted;
}

/**
 * Keeps reviews (so ratings stay honest) but strips the author's identity.
 * The userId becomes "deleted", which also means the author can never claim or
 * edit the row again.
 */
async function anonymizeReviews(db, uid) {
  const snapshot = await db.collection('reviews').where('userId', '==', uid).get();
  if (snapshot.empty) return 0;

  let updated = 0;
  for (let index = 0; index < snapshot.docs.length; index += 400) {
    const batch = db.batch();
    snapshot.docs.slice(index, index + 400).forEach((doc) =>
      batch.update(doc.ref, {
        userId: 'deleted',
        authorName: null,
        authorEmail: null,
        userPhotoURL: null,
        anonymized: true,
        anonymizedAt: FieldValue.serverTimestamp()
      })
    );
    // eslint-disable-next-line no-await-in-loop
    await batch.commit();
    updated += Math.min(400, snapshot.docs.length - index);
  }
  return updated;
}

export const adminUsersRouter = Router();

/**
 * GET /api/admin/users
 * Pagination: `pageToken` + `limit` (native Auth pagination).
 * Filters (`search`, `verified`, `provider`, `admin`, `disabled`): a bounded
 * scan of the first `USER_SCAN_LIMIT` accounts, newest results first.
 */
adminUsersRouter.get('/', async (req, res, next) => {
  try {
    const auth = requireAuth(res);
    if (!auth) return undefined;

    const parsed = parseQuery(res, req.query);
    if (!parsed) return undefined;

    const filters = {
      search: parsed.search,
      verified: boolParam(parsed.verified),
      provider: parsed.provider || '',
      admin: boolParam(parsed.admin),
      disabled: boolParam(parsed.disabled)
    };

    const filtered = Boolean(
      filters.search ||
        filters.provider ||
        filters.verified != null ||
        filters.admin != null ||
        filters.disabled != null
    );

    let records = [];
    let nextPageToken = null;
    let scanned = 0;
    let truncated = false;

    if (filtered) {
      const result = await scanAuthUsers(auth, filters);
      records = result.users;
      scanned = result.scanned;
      truncated = result.truncated;
    } else {
      let page;
      try {
        page = await auth.listUsers(parsed.limit, parsed.pageToken || undefined);
      } catch (error) {
        if (error?.code === 'auth/invalid-page-token') {
          return apiError(res, 400, 'invalid_page_token', 'That page link has expired. Start from page 1.');
        }
        throw error;
      }
      records = page.users;
      nextPageToken = page.pageToken || null;
      scanned = records.length;
    }

    const profiles = await loadProfiles(records.map((record) => record.uid));

    return res.json({
      items: records.map((record) => serializeAuthUser(record, profiles.get(record.uid) || null)),
      nextPageToken,
      filtered,
      scanned,
      scanLimit: USER_SCAN_LIMIT,
      truncated
    });
  } catch (error) {
    return next(error);
  }
});

/** GET /api/admin/users/:uid — profile plus activity counts for the drawer. */
adminUsersRouter.get('/:uid', async (req, res, next) => {
  try {
    const auth = requireAuth(res);
    if (!auth) return undefined;

    const record = await loadRecord(res, auth, req.params.uid);
    if (!record) return undefined;

    const db = getDb();
    let profile = null;
    let activity = { bookmarks: 0, reviews: 0, progress: 0 };

    if (db) {
      try {
        const [profileSnap, bookmarks, reviews, progress] = await Promise.all([
          db.collection('users').doc(record.uid).get(),
          countQuery(db.collection('bookmarks').where('userId', '==', record.uid)),
          countQuery(db.collection('reviews').where('userId', '==', record.uid)),
          countQuery(db.collection('progress').where('userId', '==', record.uid))
        ]);
        profile = profileSnap.exists ? profileSnap.data() : null;
        activity = { bookmarks, reviews, progress };
      } catch (error) {
        console.warn('[admin-users] Detail activity failed:', error?.message || error);
      }
    }

    return res.json({ user: serializeAuthUser(record, profile), activity });
  } catch (error) {
    return next(error);
  }
});

/** POST /api/admin/users/:uid/disable */
adminUsersRouter.post('/:uid/disable', async (req, res, next) => {
  try {
    const auth = requireAuth(res);
    if (!auth) return undefined;

    const record = await loadRecord(res, auth, req.params.uid);
    if (!record) return undefined;

    if (record.uid === req.user.uid) {
      return apiError(res, 400, 'cannot_disable_self', 'You cannot disable your own account.');
    }

    if (!record.disabled) {
      await auth.updateUser(record.uid, { disabled: true });
      await audit(req, 'user.disable', record.uid, {
        email: record.email || '',
        displayName: record.displayName || ''
      });
    }

    return res.json({ ok: true, disabled: true });
  } catch (error) {
    return next(error);
  }
});

/** POST /api/admin/users/:uid/enable */
adminUsersRouter.post('/:uid/enable', async (req, res, next) => {
  try {
    const auth = requireAuth(res);
    if (!auth) return undefined;

    const record = await loadRecord(res, auth, req.params.uid);
    if (!record) return undefined;

    if (record.disabled) {
      await auth.updateUser(record.uid, { disabled: false });
      await audit(req, 'user.enable', record.uid, {
        email: record.email || '',
        displayName: record.displayName || ''
      });
    }

    return res.json({ ok: true, disabled: false });
  } catch (error) {
    return next(error);
  }
});

/** POST /api/admin/users/:uid/make-admin */
adminUsersRouter.post('/:uid/make-admin', async (req, res, next) => {
  try {
    const auth = requireAuth(res);
    if (!auth) return undefined;

    const record = await loadRecord(res, auth, req.params.uid);
    if (!record) return undefined;

    if (record.customClaims?.admin !== true) {
      await auth.setCustomUserClaims(record.uid, {
        ...(record.customClaims || {}),
        admin: true
      });
      await audit(req, 'user.make_admin', record.uid, {
        email: record.email || '',
        displayName: record.displayName || ''
      });
    }

    return res.json({ ok: true, isAdmin: true });
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /api/admin/users/:uid/remove-admin
 * Refuses to remove the caller's own claim, and refuses to remove the last
 * administrator in the project.
 */
adminUsersRouter.post('/:uid/remove-admin', async (req, res, next) => {
  try {
    const auth = requireAuth(res);
    if (!auth) return undefined;

    const record = await loadRecord(res, auth, req.params.uid);
    if (!record) return undefined;

    if (record.uid === req.user.uid) {
      return apiError(
        res,
        400,
        'cannot_remove_own_admin',
        'You cannot remove your own admin access. Ask another administrator to do it.'
      );
    }

    if (record.customClaims?.admin === true) {
      const remaining = await countAdmins(auth, { excludeUid: record.uid });
      if (remaining < 1) {
        return apiError(
          res,
          409,
          'last_admin',
          'This is the last administrator. Grant admin access to someone else first.'
        );
      }

      await auth.setCustomUserClaims(record.uid, {
        ...(record.customClaims || {}),
        admin: false
      });
      await audit(req, 'user.remove_admin', record.uid, {
        email: record.email || '',
        displayName: record.displayName || ''
      });
    }

    return res.json({ ok: true, isAdmin: false });
  } catch (error) {
    return next(error);
  }
});

/** POST /api/admin/users/:uid/revoke-sessions */
adminUsersRouter.post('/:uid/revoke-sessions', async (req, res, next) => {
  try {
    const auth = requireAuth(res);
    if (!auth) return undefined;

    const record = await loadRecord(res, auth, req.params.uid);
    if (!record) return undefined;

    if (record.uid === req.user.uid) {
      return apiError(
        res,
        400,
        'cannot_revoke_self',
        'Revoking your own sessions would sign you out of the admin panel.'
      );
    }

    await auth.revokeRefreshTokens(record.uid);
    await audit(req, 'user.revoke_sessions', record.uid, {
      email: record.email || '',
      displayName: record.displayName || ''
    });

    return res.json({ ok: true, revokedAt: new Date().toISOString() });
  } catch (error) {
    return next(error);
  }
});

/**
 * DELETE /api/admin/users/:uid
 * Body: `{ confirmEmail }` — must match the account's email exactly.
 *
 * Removes the Auth account, the Firestore profile, bookmarks and progress.
 * Reviews are kept but anonymised so resource ratings stay accurate.
 */
adminUsersRouter.delete('/:uid', async (req, res, next) => {
  try {
    const auth = requireAuth(res);
    if (!auth) return undefined;

    const record = await loadRecord(res, auth, req.params.uid);
    if (!record) return undefined;

    if (record.uid === req.user.uid) {
      return apiError(res, 400, 'cannot_delete_self', 'You cannot delete your own account here.');
    }

    const parsed = deleteSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return apiError(res, 400, 'invalid_confirmation', 'Type the account email to confirm.');
    }

    const typed = sanitizeEmail(parsed.data.confirmEmail);
    const expected = sanitizeEmail(record.email || '');
    if (!expected || !EMAIL_RE.test(typed) || typed !== expected) {
      return apiError(
        res,
        400,
        'email_mismatch',
        'The typed email does not match this account.'
      );
    }

    if (record.customClaims?.admin === true) {
      const remaining = await countAdmins(auth, { excludeUid: record.uid });
      if (remaining < 1) {
        return apiError(
          res,
          409,
          'last_admin',
          'This is the last administrator and cannot be deleted.'
        );
      }
    }

    const db = getDb();
    let deletedBookmarks = 0;
    let deletedProgress = 0;
    let anonymizedReviews = 0;

    // Firestore cleanup first: if it fails we abort before removing the Auth
    // account, and the operation can be retried safely (all steps are idempotent).
    if (db) {
      deletedBookmarks = await deleteMatching(db, 'bookmarks', 'userId', record.uid);
      deletedProgress = await deleteMatching(db, 'progress', 'userId', record.uid);
      anonymizedReviews = await anonymizeReviews(db, record.uid);

      try {
        await db.collection('users').doc(record.uid).delete();
      } catch (error) {
        console.warn('[admin-users] Could not delete profile:', error?.message || error);
      }
    }

    await auth.deleteUser(record.uid);

    await audit(req, 'user.delete', record.uid, {
      email: record.email || '',
      displayName: record.displayName || '',
      deletedBookmarks,
      deletedProgress,
      anonymizedReviews,
      wasAdmin: record.customClaims?.admin === true
    });

    return res.json({
      ok: true,
      deletedBookmarks,
      deletedProgress,
      anonymizedReviews
    });
  } catch (error) {
    return next(error);
  }
});
