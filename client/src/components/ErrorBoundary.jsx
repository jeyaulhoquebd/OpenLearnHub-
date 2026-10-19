import { Component } from 'react';
import { AlertTriangle } from 'lucide-react';
import i18n from '../lib/i18n';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('[OpenLearn Hub] Unhandled error:', error, info?.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-sand-50 px-6">
          <div className="card max-w-lg p-8 text-center">
            <AlertTriangle className="mx-auto h-10 w-10 text-amber-500 dark:text-amber-400" />
            <h1 className="mt-4 font-display text-2xl font-semibold text-ink">{i18n.t('errors.title')}</h1>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">{i18n.t('errors.text')}</p>
            <button type="button" onClick={() => window.location.reload()} className="btn-primary mt-6">
              {i18n.t('errors.reload')}
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
