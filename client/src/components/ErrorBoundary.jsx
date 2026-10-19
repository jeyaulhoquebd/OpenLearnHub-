import { Component } from 'react';
import { AlertTriangle } from 'lucide-react';

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
            <AlertTriangle className="mx-auto h-10 w-10 text-amber-500" />
            <h1 className="mt-4 font-display text-2xl font-semibold text-ink">Something went wrong</h1>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              An unexpected error occurred while rendering this page. Reloading usually fixes it.
            </p>
            <button type="button" onClick={() => window.location.reload()} className="btn-primary mt-6">
              Reload OpenLearn Hub
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
