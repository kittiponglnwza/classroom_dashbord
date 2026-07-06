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
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full w-full p-8 text-center bg-dark-bg text-dark-text">
          <div className="bg-rose-500/10 text-rose-400 p-4 rounded-xl border border-rose-500/20 max-w-lg w-full">
            <h2 className="text-xl font-bold mb-2">Something went wrong</h2>
            <p className="text-sm opacity-80 mb-4">{this.state.error?.message}</p>
            <button 
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-rose-500 text-white rounded-lg font-semibold hover:bg-rose-600 transition-colors"
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
