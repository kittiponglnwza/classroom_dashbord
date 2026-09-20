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
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // You can also log the error to an error reporting service
    logger.error('GlobalErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload(); // Force refresh to clear bad state
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
        <div className="min-h-screen bg-dark-bg flex items-center justify-center p-6 text-dark-text">
          <div className="max-w-md w-full bg-dark-card border border-dark-border rounded-2xl p-8 shadow-2xl flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-rose-500/20 text-rose-400 rounded-full flex items-center justify-center mb-6">
              <AlertCircle size={32} />
            </div>
            
            <h1 className="text-2xl font-bold text-dark-text mb-3">
              Something went wrong
            </h1>
            
            <p className="text-dark-muted mb-6">
              The application encountered an unexpected error. Please refresh the page to try again.
            </p>

            <div className="bg-dark-bg border border-dark-border rounded p-4 text-center w-full mb-8">
              <p className="text-sm font-medium text-rose-400 mb-1">{errorMsg}</p>
              {errorCode && <p className="text-xs text-dark-muted mt-2">{errorCode}</p>}
            </div>
            
            <button
              onClick={this.handleReset}
              className="w-full py-3 px-4 bg-brand-500 hover:bg-brand-600 active:bg-brand-700 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <RefreshCw size={18} />
              Refresh Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children; 
  }
}
