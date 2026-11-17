import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { logger } from '../utils/logger';
import { NetworkError, AuthError, RateLimitError, StorageError, ParserError, ValidationError } from '../utils/errors';

export class GlobalErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    logger.error('GlobalErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  getErrorMessage(error) {
    if (!error) return 'An unknown error occurred.';

    if (error instanceof NetworkError || error.name === 'NetworkError') {
      return 'Network connection failed. Please check your internet connection.';
    }
    if (error instanceof AuthError || error.name === 'AuthError') {
      return 'Authentication failed or session expired. Please log in again.';
    }
    if (error instanceof RateLimitError || error.name === 'RateLimitError') {
      return 'Too many requests. Please slow down and try again later.';
    }
    if (error instanceof StorageError || error.name === 'StorageError') {
      return 'Failed to read or write local data. Your browser storage might be full.';
    }
    if (error instanceof ParserError || error.name === 'ParserError' || error instanceof ValidationError || error.name === 'ValidationError') {
      return 'Data processing failed. The application received unexpected data.';
    }

    return error.message || 'An unexpected application error occurred.';
  }

  getErrorCode(error) {
    if (error && error.code) return `(Code: ${error.code})`;
    return '';
  }

  render() {
    if (this.state.hasError) {
      const errorMsg = this.getErrorMessage(this.state.error);
      const errorCode = this.getErrorCode(this.state.error);

      return (
        <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center p-6 text-[#1D1D1F]">
          <div className="max-w-md w-full bg-white border border-[#D2D2D7] rounded-2xl p-8 shadow-xs flex flex-col items-center text-center">
            <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mb-4">
              <AlertCircle size={24} />
            </div>

            <h1 className="text-xl font-semibold text-[#1D1D1F] mb-2">
              Something went wrong
            </h1>

            <p className="text-xs text-[#6E6E73] mb-5">
              The application encountered an unexpected error. Please refresh the page to try again.
            </p>

            <div className="bg-[#F5F5F7] border border-[#D2D2D7] rounded-xl p-3.5 text-center w-full mb-6">
              <p className="text-xs font-medium text-rose-700">{errorMsg}</p>
              {errorCode && <p className="text-[11px] text-[#6E6E73] mt-1">{errorCode}</p>}
            </div>

            <button
              type="button"
              onClick={this.handleReset}
              className="w-full py-2.5 px-4 bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-medium rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <RefreshCw size={15} />
              Refresh Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
