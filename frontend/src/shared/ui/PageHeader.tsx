import { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  children?: ReactNode;
  className?: string;
}

/**
 * Standard page header component with title, description and actions slot.
 * Used across all pages for consistent header styling.
 */
export function PageHeader({
  title,
  description,
  children,
  className = '',
}: PageHeaderProps) {
  return (
    <div className={`flex justify-between items-center ${className}`}>
      <div>
        <h1 className="text-3xl font-bold font-display tracking-tight text-foreground">
          {title}
        </h1>
        {description && (
          <p className="text-sm mt-1 text-foreground/60">{description}</p>
        )}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}
