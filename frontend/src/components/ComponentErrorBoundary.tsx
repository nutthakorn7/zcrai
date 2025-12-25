import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Card, CardBody, Button } from '@heroui/react';
import { Icon } from '../shared/ui';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ComponentErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Card className="h-full w-full bg-danger/10 border-danger/20 flex items-center justify-center">
            <CardBody className="text-center">
                <div className="w-16 h-16 rounded-full bg-danger/20 flex items-center justify-center mx-auto mb-4">
                    <Icon.Alert className="w-8 h-8 text-danger" />
                </div>
                <h3 className="text-xl font-bold text-danger mb-2">Component Error</h3>
                <p className="text-foreground/60 mb-4 max-w-md mx-auto">
                    {this.state.error?.message || "Something went wrong while loading this component."}
                </p>
                <Button 
                    color="danger" 
                    variant="flat" 
                    onPress={() => this.setState({ hasError: false })}
                >
                    Try Again
                </Button>
            </CardBody>
        </Card>
      );
    }

    return this.props.children;
  }
}
