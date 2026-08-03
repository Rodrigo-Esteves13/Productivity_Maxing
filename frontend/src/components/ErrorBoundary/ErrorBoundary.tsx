import { Component, type ErrorInfo, type ReactNode } from 'react';
import { reportClientError } from '../../api/telemetryService';
import { AlertTriangleIcon } from '../UI/Icons';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Catches render-time errors anywhere in the tree below it (React error
 * boundaries only catch render/lifecycle errors - NOT errors inside event
 * handlers, async code, or the boundary's own render, which is why the
 * fallback UI below is deliberately minimal and can't itself throw) and
 * reports them via the telemetry endpoint (see telemetryService.ts /
 * TelemetryController on the backend) instead of leaving the user staring
 * at a blank white screen with a stack trace only visible in devtools.
 *
 * Wrapped around the whole app in App.tsx, outside AuthProvider/
 * AcademicProvider - a crash inside either of those shouldn't itself be
 * unrecoverable without a full page reload from a blank screen.
 */
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    reportClientError({
      message: error.message,
      stack: error.stack,
      componentStack: info.componentStack ?? undefined,
      url: window.location.href,
    });
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-center px-4">
        <div className="max-w-md">
          <div className="mx-auto mb-6 w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center text-red-400">
            <AlertTriangleIcon width={28} height={28} />
          </div>
          <h1 className="text-2xl font-semibold text-white mb-2">Something went wrong</h1>
          <p className="text-neutral-400 mb-6">
            The app hit an unexpected error. It's been reported - reloading usually fixes it.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors"
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}
