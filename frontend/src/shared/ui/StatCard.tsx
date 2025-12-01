import { ReactNode } from 'react';
import { Icon } from './icon';

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  iconBg?: string;
  iconColor?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  onClick?: () => void;
  className?: string;
}

export function StatCard({
  label,
  value,
  trend,
  onClick,
  className = '',
}: StatCardProps) {
  return (
    <div
      className={`
        bg-content1 border border-white/5 hover:border-white/10 
        rounded-xl p-5 transition-all
        ${onClick ? 'cursor-pointer' : ''}
        ${className}
      `}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-6">
        <p className="text-sm text-foreground/50">{label}</p>
        {trend && (
          <div
            className={`flex items-center gap-1 text-xs font-medium ${
              trend.isPositive ? 'text-red-500' : 'text-green-500'
            }`}
          >
            {trend.value !== 0 && (
              trend.isPositive ? (
                <Icon.TrendingUp className="w-3 h-3" />
              ) : (
                <Icon.TrendingDown className="w-3 h-3" />
              )
            )}
            <span>{Math.abs(trend.value).toFixed(1)}%</span>
          </div>
        )}
      </div>
      <div>
        <p className="text-3xl font-semibold text-foreground">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </p>
      </div>
    </div>
  );
}
