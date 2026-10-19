import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import GoogleIcon from './GoogleIcon';
import GithubIcon from './GithubIcon';
import AppleIcon from './AppleIcon';
import { SIGN_IN_PROVIDERS } from '../context/AuthContext';

const PROVIDER_META = {
  google: { labelKey: 'auth.google', shortKey: 'auth.providerGoogle', Icon: GoogleIcon, iconClass: 'h-4 w-4' },
  github: { labelKey: 'auth.github', shortKey: 'auth.providerGithub', Icon: GithubIcon, iconClass: 'h-4 w-4 text-ink' },
  apple: { labelKey: 'auth.apple', shortKey: 'auth.providerApple', Icon: AppleIcon, iconClass: 'h-4 w-4 text-ink' }
};

/**
 * The three social sign-in buttons (Google, GitHub, Apple) with translated
 * labels. `onSelect` receives the provider id.
 */
export default function SocialAuthButtons({ onSelect, disabled = false, activeProvider = '' }) {
  const { t } = useTranslation();

  return (
    <div className="space-y-2.5">
      {SIGN_IN_PROVIDERS.map((providerId) => {
        const meta = PROVIDER_META[providerId];
        const Icon = meta.Icon;
        const busy = activeProvider === providerId;
        return (
          <button
            key={providerId}
            type="button"
            onClick={() => onSelect(providerId)}
            disabled={disabled}
            aria-busy={busy}
            className="btn-secondary w-full justify-center py-3 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className={meta.iconClass} />}
            {t(meta.labelKey)}
          </button>
        );
      })}
    </div>
  );
}
