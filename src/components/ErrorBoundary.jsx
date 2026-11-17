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
        <div className="flex flex-col items-center justify-center h-full w-full p-8 text-center bg-[#F5F5F7] text-[#1D1D1F]">
          <div className="bg-white p-6 rounded-2xl border border-[#D2D2D7] shadow-xs max-w-md w-full space-y-3">
            <h2 className="text-lg font-semibold text-[#1D1D1F]">Something went wrong</h2>
            <p className="text-xs text-[#6E6E73]">{this.state.error?.message}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-[#0071E3] text-white text-xs rounded-xl font-medium hover:bg-[#0077ED] transition-colors cursor-pointer"
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
