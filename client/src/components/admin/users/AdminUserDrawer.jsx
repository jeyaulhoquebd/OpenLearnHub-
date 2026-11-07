import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  Ban,
  Bookmark,
  CheckCircle2,
  Copy,
  Loader2,
  LogOut,
  MessageSquare,
  RotateCw,
  ShieldCheck,
  ShieldOff,
  Trash2
} from 'lucide-react';
import Drawer from '../ui/Drawer';
import Modal from '../ui/Modal';
import ConfirmDialog from '../ui/ConfirmDialog';
import { AccountStatusBadge, ProviderIcons, RoleBadge, UserAvatar, VerifiedBadge } from './UserBadges';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import {
  deleteAdminUser,
  disableAdminUser,
  enableAdminUser,
  getAdminUser,
  makeAdminUser,
  removeAdminUser,
  revokeAdminUserSessions
} from '../../../lib/api';
import { formatDate, formatNumber } from '../../../lib/utils';

const CONFIRMS = {
  disable: {
    action: 'admin.users.actions.disable',
    title: 'admin.users.confirm.disableTitle',
    message: 'admin.users.confirm.disableMessage',
    success: 'admin.users.confirm.disableSuccess',
    tone: 'danger',
    run: (uid, token) => disableAdminUser(uid, token)
  },
  enable: {
    action: 'admin.users.actions.enable',
    title: 'admin.users.confirm.enableTitle',
    message: 'admin.users.confirm.enableMessage',
    success: 'admin.users.confirm.enableSuccess',
    tone: 'primary',
    run: (uid, token) => enableAdminUser(uid, token)
  },
  makeAdmin: {
    action: 'admin.users.actions.makeAdmin',
    title: 'admin.users.confirm.makeAdminTitle',
    message: 'admin.users.confirm.makeAdminMessage',
    success: 'admin.users.confirm.makeAdminSuccess',
    tone: 'primary',
    run: (uid, token) => makeAdminUser(uid, token)
  },
  removeAdmin: {
    action: 'admin.users.actions.removeAdmin',
    title: 'admin.users.confirm.removeAdminTitle',
    message: 'admin.users.confirm.removeAdminMessage',
    success: 'admin.users.confirm.removeAdminSuccess',
    tone: 'danger',
    run: (uid, token) => removeAdminUser(uid, token)
  },
  revoke: {
    action: 'admin.users.actions.revoke',
    title: 'admin.users.confirm.revokeTitle',
    message: 'admin.users.confirm.revokeMessage',
    success: 'admin.users.confirm.revokeSuccess',
    tone: 'danger',
    run: (uid, token) => revokeAdminUserSessions(uid, token)
  }
};

function InfoRow({ label, children }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <dt className="shrink-0 text-xs font-semibold uppercase tracking-wide text-ink-muted">
        {label}
      </dt>
      <dd className="min-w-0 text-end text-sm text-ink">{children}</dd>
    </div>
  );
}

function ActivityTile({ icon: Icon, label, value }) {
  return (
    <div className="rounded-xl border border-sand-200 bg-sand-50 p-3 text-center">
      <Icon className="mx-auto h-4 w-4 text-ink-muted" aria-hidden="true" />
      <p className="mt-1.5 font-display text-lg font-semibold text-ink">{value}</p>
      <p className="text-[11px] text-ink-muted">{label}</p>
    </div>
  );
}

/**
 * User detail drawer.
 *
 * Loads profile + activity counts on open, then exposes the four privileged
 * account actions. Every action confirms first; deletion additionally requires
 * typing the account email. Actions that would affect the signed-in admin are
 * disabled in the UI (and rejected by the API).
 */
export default function AdminUserDrawer({ open, uid, onClose, onChanged }) {
  const { t, i18n } = useTranslation();
  const { user: authUser } = useAuth();
  const { push } = useToast();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [confirmKey, setConfirmKey] = useState(null);
  const [busy, setBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [emailInput, setEmailInput] = useState('');

  const isSelf = Boolean(uid && authUser?.uid === uid);

  const load = useCallback(async () => {
    if (!open || !uid || !authUser) return;
    setLoading(true);
    setError(null);
    try {
      const token = await authUser.getIdToken();
      const result = await getAdminUser(uid, token);
      setData(result);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [open, uid, authUser]);

  useEffect(() => {
    load();
  }, [load, reloadToken]);

  useEffect(() => {
    if (!open) {
      setData(null);
      setError(null);
      setConfirmKey(null);
      setDeleteOpen(false);
      setEmailInput('');
    }
  }, [open]);

  const profile = data?.user || null;
  const activity = data?.activity || { bookmarks: 0, reviews: 0, progress: 0 };

  const displayName = profile?.displayName || profile?.email || uid || '';
  const confirmMeta = confirmKey ? CONFIRMS[confirmKey] : null;

  const canDisable = !isSelf && !profile?.disabled;
  const canEnable = !isSelf && profile?.disabled;

  const providerLabels = useMemo(
    () => (profile?.providers || []).map((key) => t(`admin.users.providers.${key}`)).join(', '),
    [profile, t]
  );

  async function copyUid() {
    try {
      await navigator.clipboard.writeText(uid);
      push(t('admin.users.drawer.copied'), { type: 'success' });
    } catch {
      push(t('admin.users.drawer.copyFailed'), { type: 'error' });
    }
  }

  async function runConfirm() {
    if (!confirmMeta) return;
    setBusy(true);
    try {
      const token = await authUser.getIdToken();
      await confirmMeta.run(uid, token);
      push(t(confirmMeta.success, { name: displayName }), { type: 'success' });
      setConfirmKey(null);
      setReloadToken((value) => value + 1);
      onChanged?.();
    } catch (err) {
      push(err.message || t('admin.users.actionError'), { type: 'error' });
    } finally {
      setBusy(false);
    }
  }

  async function runDelete() {
    setBusy(true);
    try {
      const token = await authUser.getIdToken();
      const result = await deleteAdminUser(uid, emailInput, token);
      push(
        t('admin.users.confirm.deleteSuccess', {
          name: displayName,
          reviews: result.anonymizedReviews || 0
        }),
        { type: 'success' }
      );
      setDeleteOpen(false);
      setEmailInput('');
      onChanged?.();
      onClose?.();
    } catch (err) {
      push(err.message || t('admin.users.actionError'), { type: 'error' });
    } finally {
      setBusy(false);
    }
  }

  const typedMatches =
    Boolean(profile?.email) &&
    emailInput.trim().toLowerCase() === String(profile.email).trim().toLowerCase();

  return (
    <>
      <Drawer
        open={open}
        onClose={busy ? () => {} : onClose}
        width="lg"
        title={t('admin.users.drawer.title')}
        description={t('admin.users.drawer.subtitle')}
      >
        {loading ? (
          <div className="space-y-4" aria-busy="true">
            <div className="flex items-center gap-3">
              <span className="skeleton h-16 w-16 rounded-full" />
              <div className="flex-1 space-y-2">
                <span className="skeleton block h-5 w-40 rounded" />
                <span className="skeleton block h-4 w-56 rounded" />
              </div>
            </div>
            <span className="skeleton block h-24 w-full rounded-xl" />
            <span className="skeleton block h-40 w-full rounded-xl" />
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-center dark:border-rose-500/30 dark:bg-rose-500/10">
            <AlertTriangle className="mx-auto h-8 w-8 text-rose-500" aria-hidden="true" />
            <p className="mt-2 text-sm font-semibold text-ink">{t('admin.users.drawer.errorTitle')}</p>
            <p className="mt-1 text-xs text-ink-soft">{t('admin.users.drawer.errorText')}</p>
            {error?.message ? <p className="mt-1 text-xs text-ink-muted">{error.message}</p> : null}
            <button
              type="button"
              onClick={() => setReloadToken((value) => value + 1)}
              className="btn-secondary mt-3"
            >
              <RotateCw className="h-4 w-4" aria-hidden="true" />
              {t('admin.users.retry')}
            </button>
          </div>
        ) : profile ? (
          <div className="space-y-5">
            <div className="flex items-start gap-4">
              <UserAvatar
                name={profile.displayName}
                email={profile.email}
                photoURL={profile.photoURL}
                size="lg"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate font-display text-lg font-semibold text-ink">
                    {profile.displayName || t('admin.users.noName')}
                  </h3>
                  {isSelf && (
                    <span className="chip border border-accent-300 bg-accent-500/10 text-accent-700 dark:border-accent-500/40 dark:text-accent-300">
                      {t('admin.users.you')}
                    </span>
                  )}
                </div>
                <p className="truncate text-sm text-ink-soft" dir="ltr">
                  {profile.email || t('admin.users.noEmail')}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <RoleBadge isAdmin={profile.isAdmin} />
                  <AccountStatusBadge disabled={profile.disabled} />
                  <VerifiedBadge verified={profile.emailVerified} />
                </div>
              </div>
            </div>

            <dl className="divide-y divide-sand-100 rounded-2xl border border-sand-200 bg-surface px-4 py-1">
              <InfoRow label={t('admin.users.drawer.accountId')}>
                <span className="inline-flex items-center gap-1.5">
                  <code className="break-all font-mono text-xs" dir="ltr">
                    {profile.uid}
                  </code>
                  <button
                    type="button"
                    onClick={copyUid}
                    aria-label={t('admin.users.drawer.copyId')}
                    className="grid h-6 w-6 place-items-center rounded text-ink-muted transition hover:bg-sand-100 hover:text-ink"
                  >
                    <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </span>
              </InfoRow>
              <InfoRow label={t('admin.users.drawer.providers')}>
                <span className="inline-flex flex-col items-end gap-1">
                  <ProviderIcons providers={profile.providers} />
                  <span className="text-xs text-ink-muted">{providerLabels}</span>
                </span>
              </InfoRow>
              <InfoRow label={t('admin.users.drawer.joined')}>
                {formatDate(profile.createdAt, i18n.language)}
              </InfoRow>
              <InfoRow label={t('admin.users.drawer.lastLogin')}>
                {formatDate(profile.lastSignInAt, i18n.language)}
              </InfoRow>
              <InfoRow label={t('admin.users.drawer.language')}>
                {profile.preferredLanguage
                  ? t(`admin.users.languages.${profile.preferredLanguage}`)
                  : '—'}
              </InfoRow>
            </dl>

            <div>
              <h4 className="text-sm font-semibold text-ink">{t('admin.users.drawer.activity')}</h4>
              <p className="mb-2 text-xs text-ink-muted">{t('admin.users.drawer.activityHint')}</p>
              <div className="grid grid-cols-3 gap-2">
                <ActivityTile
                  icon={Bookmark}
                  label={t('admin.users.drawer.bookmarks')}
                  value={formatNumber(activity.bookmarks, i18n.language)}
                />
                <ActivityTile
                  icon={MessageSquare}
                  label={t('admin.users.drawer.reviews')}
                  value={formatNumber(activity.reviews, i18n.language)}
                />
                <ActivityTile
                  icon={CheckCircle2}
                  label={t('admin.users.drawer.progress')}
                  value={formatNumber(activity.progress, i18n.language)}
                />
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-ink">{t('admin.users.drawer.actionsTitle')}</h4>
              {isSelf && (
                <p className="mt-1 rounded-lg border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
                  {t('admin.users.drawer.selfNote')}
                </p>
              )}

              <div className="mt-3 space-y-2">
                <button
                  type="button"
                  disabled={!canDisable && !canEnable}
                  onClick={() => setConfirmKey(profile.disabled ? 'enable' : 'disable')}
                  className="flex w-full items-center gap-3 rounded-xl border border-sand-200 bg-surface px-3 py-2.5 text-start transition hover:border-sand-300 hover:bg-sand-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {profile.disabled ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                  ) : (
                    <Ban className="h-4 w-4 text-rose-500" aria-hidden="true" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-ink">
                      {profile.disabled
                        ? t('admin.users.actions.enable')
                        : t('admin.users.actions.disable')}
                    </span>
                    <span className="block text-xs text-ink-muted">
                      {profile.disabled
                        ? t('admin.users.actions.enableHint')
                        : t('admin.users.actions.disableHint')}
                    </span>
                  </span>
                </button>

                <button
                  type="button"
                  disabled={isSelf}
                  onClick={() => setConfirmKey(profile.isAdmin ? 'removeAdmin' : 'makeAdmin')}
                  className="flex w-full items-center gap-3 rounded-xl border border-sand-200 bg-surface px-3 py-2.5 text-start transition hover:border-sand-300 hover:bg-sand-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {profile.isAdmin ? (
                    <ShieldOff className="h-4 w-4 text-rose-500" aria-hidden="true" />
                  ) : (
                    <ShieldCheck className="h-4 w-4 text-accent-600" aria-hidden="true" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-ink">
                      {profile.isAdmin
                        ? t('admin.users.actions.removeAdmin')
                        : t('admin.users.actions.makeAdmin')}
                    </span>
                    <span className="block text-xs text-ink-muted">
                      {profile.isAdmin
                        ? t('admin.users.actions.removeAdminHint')
                        : t('admin.users.actions.makeAdminHint')}
                    </span>
                  </span>
                </button>

                <button
                  type="button"
                  disabled={isSelf}
                  onClick={() => setConfirmKey('revoke')}
                  className="flex w-full items-center gap-3 rounded-xl border border-sand-200 bg-surface px-3 py-2.5 text-start transition hover:border-sand-300 hover:bg-sand-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <LogOut className="h-4 w-4 text-ink-muted" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-ink">
                      {t('admin.users.actions.revoke')}
                    </span>
                    <span className="block text-xs text-ink-muted">
                      {t('admin.users.actions.revokeHint')}
                    </span>
                  </span>
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-rose-200 bg-rose-50/60 p-4 dark:border-rose-500/30 dark:bg-rose-500/5">
              <h4 className="flex items-center gap-2 text-sm font-semibold text-rose-700 dark:text-rose-300">
                <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                {t('admin.users.drawer.dangerZone')}
              </h4>
              <p className="mt-1 text-xs leading-relaxed text-ink-soft">
                {t('admin.users.drawer.dangerHint')}
              </p>
              <button
                type="button"
                disabled={isSelf}
                onClick={() => setDeleteOpen(true)}
                className="btn mt-3 border border-rose-300 bg-rose-600 text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                {t('admin.users.actions.delete')}
              </button>
              {profile.isAdmin && !isSelf ? (
                <p className="mt-2 text-[11px] text-ink-muted">
                  {t('admin.users.drawer.deleteAdminHint')}
                </p>
              ) : null}
            </div>

            <p className="text-center text-[11px] text-ink-muted">
              {t('admin.users.drawer.auditNote')}
            </p>
          </div>
        ) : null}
      </Drawer>

      <ConfirmDialog
        open={Boolean(confirmMeta)}
        loading={busy}
        title={confirmMeta ? t(confirmMeta.title) : ''}
        message={confirmMeta ? t(confirmMeta.message, { name: displayName }) : ''}
        confirmLabel={confirmMeta ? t(confirmMeta.action) : ''}
        tone={confirmMeta?.tone || 'danger'}
        onCancel={() => setConfirmKey(null)}
        onConfirm={runConfirm}
      />

      <Modal
        open={deleteOpen}
        onClose={busy ? () => {} : () => setDeleteOpen(false)}
        size="md"
        title={t('admin.users.confirm.deleteTitle')}
        description={t('admin.users.confirm.deleteMessage', { name: displayName })}
        footer={
          <>
            <button
              type="button"
              onClick={() => setDeleteOpen(false)}
              disabled={busy}
              className="btn-secondary"
            >
              {t('admin.ui.cancel')}
            </button>
            <button
              type="button"
              onClick={runDelete}
              disabled={busy || !typedMatches}
              className="btn border border-red-200 bg-red-600 text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-500/40"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {t('admin.users.confirm.deleteConfirm')}
            </button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-ink-soft">
          {t('admin.users.confirm.deleteDetail')}
        </p>
        <label htmlFor="delete-user-email" className="mt-4 block text-sm font-semibold text-ink">
          {t('admin.users.confirm.emailLabel', { email: profile?.email || '' })}
        </label>
        <input
          id="delete-user-email"
          type="email"
          dir="ltr"
          autoComplete="off"
          value={emailInput}
          onChange={(event) => setEmailInput(event.target.value)}
          placeholder={profile?.email || ''}
          className="input mt-1.5"
          aria-invalid={emailInput ? !typedMatches : undefined}
        />
        {emailInput && !typedMatches ? (
          <p className="mt-1.5 text-xs font-medium text-rose-600 dark:text-rose-400" role="alert">
            {t('admin.users.confirm.emailMismatch')}
          </p>
        ) : null}
      </Modal>
    </>
  );
}
