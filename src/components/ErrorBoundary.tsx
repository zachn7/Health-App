import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ error, errorInfo });
    
    // Log to console for debugging
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // In production, you might want to send this to an error reporting service
    if (import.meta.env.MODE === 'production') {
      console.error('Production error details:', {
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack
      });
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
    
    // Also clear any localStorage issues that might cause startup errors
    try {
      const keysToCheck = ['age_gate_accepted', 'onboarding_completed'];
      const problematicKeys: string[] = [];
      
      keysToCheck.forEach(key => {
        try {
          const value = localStorage.getItem(key);
          if (value && !['true', 'false', 'null'].includes(value)) {
            console.warn(`Suspicious localStorage value for ${key}:`, value);
            problematicKeys.push(key);
          }
        } catch (e) {
          console.error(`Error reading localStorage key ${key}:`, e);
          problematicKeys.push(key);
        }
      });
      
      if (problematicKeys.length > 0) {
        console.log('Clearing problematic localStorage keys:', problematicKeys);
        problematicKeys.forEach(key => localStorage.removeItem(key));
      }
    } catch (e) {
      console.error('Error while checking localStorage:', e);
    }
    
    // Also try to clear some IndexedDB data if needed
    try {
      if ('indexedDB' in window) {
        console.log('IndexedDB available, checking for issues...');
        // We could implement more sophisticated DB health checks here
      }
    } catch (e) {
      console.error('Error checking IndexedDB:', e);
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
            <div className="text-center">
              <div className="mx-auto h-12 w-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
                <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.736 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h1 className="text-xl font-bold text-gray-900 mb-2">Application Error</h1>
              <p className="text-gray-600 mb-6">
                Something went wrong while loading the app. This might be due to outdated cached data.
              </p>
              
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <div className="text-left mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
                  <h3 className="text-sm font-medium text-red-900 mb-2">Development Error Details:</h3>
                  <p className="text-xs text-red-700 font-mono mb-2">
                    {this.state.error.message}
                  </p>
                  <details className="text-xs text-red-600">
                    <summary className="cursor-pointer hover:text-red-800">
                      Stack Trace
                    </summary>
                    <pre className="mt-2 whitespace-pre-wrap">
                      {this.state.error.stack}
                    </pre>
                  </details>
                  {this.state.errorInfo && (
                    <details className="text-xs text-red-600 mt-2">
                      <summary className="cursor-pointer hover:text-red-800">
                        Component Stack
                      </summary>
                      <pre className="mt-2 whitespace-pre-wrap">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </details>
                  )}
                </div>
              )}
              
              <div className="space-y-3">
                <button
                  onClick={this.handleReset}
                  className="w-full btn btn-primary"
                >
                  Reset & Reload
                </button>
                
                <button
                  onClick={() => window.location.reload()}
                  className="w-full btn btn-secondary"
                >
                  Reload Page
                </button>
                
                <button
                  onClick={() => {
                    // Hard reset - clear all app data
                    if (confirm('This will clear all your fitness data. Are you sure?')) {
                      localStorage.clear();
                      sessionStorage.clear();
                      
                      // Clear IndexedDB
                      if ('indexedDB' in window) {
                        indexedDB.databases().then(dbs => {
                          dbs.forEach(db => {
                            try {
                              indexedDB.deleteDatabase(db.name!);
                            } catch (e) {
                              console.error('Failed to delete DB:', db.name, e);
                            }
                          });
                        });
                      }
                      
                      // Clear service worker caches
                      if ('caches' in window) {
                        caches.keys().then(cacheNames => {
                          cacheNames.forEach(cacheName => {
                            caches.delete(cacheName);
                          });
                        });
                      }
                      
                      window.location.reload();
                    }
                  }}
                  className="w-full btn btn-danger"
                  style={{
                    backgroundColor: '#dc2626',
                    color: 'white',
                    padding: '0.5rem 1rem',
                    borderRadius: '0.375rem',
                    border: 'none'
                  }}
                >
                  Clear All Data & Reload
                </button>
              </div>
              
              <p className="text-xs text-gray-500 mt-6">
                If this problem persists, please refresh the page or clear your browser cache.
              </p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;