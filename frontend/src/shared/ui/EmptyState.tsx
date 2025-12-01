import { ReactNode } from 'react';
import { Icon } from './icon';

interface EmptyStateProps {
  icon?: ReactNode;
  title?: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({
  icon,
  title = 'No data found',
  description = 'Try adjusting your filters or date range',
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="w-16 h-16 rounded-full bg-foreground/5 flex items-center justify-center mb-4">
        {icon || <Icon.Database className="w-8 h-8 text-foreground/30" />}
      </div>
      <h3 className="text-base font-medium text-foreground mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-foreground/50 text-center max-w-sm mb-4">
          {description}
        </p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-background text-sm font-medium transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
