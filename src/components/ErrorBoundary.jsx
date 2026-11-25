import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full w-full p-8 text-center bg-[var(--app-bg)] text-[var(--text-primary)]">
          <div className="bg-[var(--surface)] p-6 rounded-xl border border-[var(--border-strong)] max-w-md w-full space-y-3">
            <h2 className="text-lg font-medium text-[var(--text-heading)]">Something went wrong</h2>
            <p className="text-xs text-[var(--text-secondary)]">{this.state.error?.message}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-[var(--primary)] text-white text-xs rounded-lg font-medium hover:bg-[var(--primary-hover)] transition-colors cursor-pointer"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
