import { Component, ErrorInfo, ReactNode } from 'react';
import { Button, Card, CardBody } from '@heroui/react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Global Error Boundary
 * Catches React errors and displays a fallback UI instead of crashing
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });
    
    // Error reporting service could be integrated here in the future
    // if (process.env.NODE_ENV === 'production') {
    //   sendToErrorTracking(error, errorInfo);
    // }
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <Card className="max-w-md w-full bg-content1 border border-danger/20">
            <CardBody className="p-8 text-center space-y-6">
              {/* Error Icon */}
              <div className="w-16 h-16 mx-auto rounded-full bg-danger/10 flex items-center justify-center">
                <svg 
                  className="w-8 h-8 text-danger" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
                  />
                </svg>
              </div>

              {/* Error Message */}
              <div>
                <h2 className="text-xl font-bold text-foreground mb-2">
                  Something went wrong
                </h2>
                <p className="text-default-500 text-sm">
                  An unexpected error occurred. Please try again or contact support if the problem persists.
                </p>
              </div>

              {/* Error Details (Dev Only) */}
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <div className="bg-danger/5 rounded-lg p-4 text-left">
                  <p className="text-xs text-danger font-mono break-all">
                    {this.state.error.message}
                  </p>
                  {this.state.errorInfo && (
                    <pre className="text-xs text-default-400 mt-2 overflow-auto max-h-32">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 justify-center">
                <Button 
                  color="primary" 
                  variant="flat"
                  onPress={this.handleReload}
                >
                  Reload Page
                </Button>
                <Button 
                  color="default" 
                  variant="ghost"
                  onPress={this.handleGoHome}
                >
                  Go Home
                </Button>
              </div>
            </CardBody>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
