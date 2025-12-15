import { Spinner } from '@heroui/react';

interface LoadingStateProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function LoadingState({ message = 'Loading...', size = 'lg' }: LoadingStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <Spinner size={size} color="primary" />
      {message && (
        <p className="mt-4 text-sm text-foreground/60">{message}</p>
      )}
    </div>
  );
}
