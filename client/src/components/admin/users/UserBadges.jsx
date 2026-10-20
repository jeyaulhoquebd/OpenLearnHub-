import { Apple, BadgeCheck, Chrome, Github, KeyRound, Mail, ShieldCheck, UserRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { initials } from '../../../lib/utils';

/**
 * Small presentational pieces shared by the users table and the detail drawer:
 * avatar, provider icons, role, verified and account-status badges.
 */

const PROVIDER_ICONS = {
  password: Mail,
  google: Chrome,
  github: Github,
  apple: Apple,
  other: KeyRound
};

export function UserAvatar({ name = '', email = '', photoURL = null, size = 'md' }) {
  const sizes = {
    sm: 'h-8 w-8 text-[11px]',
    md: 'h-10 w-10 text-xs',
    lg: 'h-16 w-16 text-lg'
  };
  const label = initials(name || email) || '?';

  return (
    <span
      className={`grid shrink-0 place-items-center overflow-hidden rounded-full bg-navy-900 font-semibold text-white shadow-sm ${sizes[size] || sizes.md}`}
      aria-hidden="true"
    >
      {photoURL ? (
        <img src={photoURL} alt="" className="h-full w-full object-cover" loading="lazy" />
      ) : (
        label
      )}
    </span>
  );
}

/** Compact provider icon strip; each icon carries its own accessible label. */
export function ProviderIcons({ providers = [] }) {
  const { t } = useTranslation();
  const list = providers.length ? providers : ['password'];

  return (
    <span className="inline-flex items-center gap-1.5">
      {list.map((provider) => {
        const Icon = PROVIDER_ICONS[provider] || KeyRound;
        return (
          <span
            key={provider}
            title={t(`admin.users.providers.${provider}`)}
            className="grid h-7 w-7 place-items-center rounded-lg border border-sand-200 bg-sand-50 text-ink-muted"
          >
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="sr-only">{t(`admin.users.providers.${provider}`)}</span>
          </span>
        );
      })}
    </span>
  );
}

export function RoleBadge({ isAdmin }) {
  const { t } = useTranslation();
  return isAdmin ? (
    <span className="chip border border-accent-300 bg-accent-500/10 text-accent-700 dark:border-accent-500/40 dark:text-accent-300">
      <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
      {t('admin.users.roleAdmin')}
    </span>
  ) : (
    <span className="chip border border-sand-300 bg-sand-100 text-ink-muted">
      <UserRound className="h-3.5 w-3.5" aria-hidden="true" />
      {t('admin.users.roleUser')}
    </span>
  );
}

export function VerifiedBadge({ verified }) {
  const { t } = useTranslation();
  return verified ? (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
      <BadgeCheck className="h-4 w-4" aria-hidden="true" />
      {t('admin.users.verified')}
    </span>
  ) : (
    <span className="text-xs font-medium text-ink-muted">{t('admin.users.unverified')}</span>
  );
}

export function AccountStatusBadge({ disabled }) {
  const { t } = useTranslation();
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium ${
        disabled ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-300'
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${disabled ? 'bg-rose-500' : 'bg-emerald-500'}`}
        aria-hidden="true"
      />
      {disabled ? t('admin.users.statusDisabled') : t('admin.users.statusActive')}
    </span>
  );
}
