import { ReactNode } from 'react';
import { Input, Select, SelectItem, Button } from '@heroui/react';
import { Icon } from './icon';

interface FilterOption {
  key: string;
  label: string;
}

interface Filter {
  key: string;
  label: string;
  options: FilterOption[];
  value: string;
  onChange: (value: string) => void;
}

interface FilterToolbarProps {
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  filters?: Filter[];
  onClear?: () => void;
  showClearButton?: boolean;
  children?: ReactNode;
  className?: string;
}

/**
 * Reusable filter toolbar with search input and filter dropdowns.
 * Used for data filtering across pages like Alerts, Observables, etc.
 */
export function FilterToolbar({
  searchValue = '',
  onSearchChange,
  searchPlaceholder = 'Search...',
  filters = [],
  onClear,
  showClearButton = true,
  children,
  className = '',
}: FilterToolbarProps) {
  const hasActiveFilters =
    searchValue.length > 0 || filters.some((f) => f.value !== '' && f.value !== 'all');

  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      {onSearchChange && (
        <Input
          placeholder={searchPlaceholder}
          value={searchValue}
          onValueChange={onSearchChange}
          startContent={<Icon.Search className="w-4 h-4 text-foreground/40" />}
          classNames={{
            base: 'max-w-xs',
            inputWrapper: 'bg-content1 border border-white/5',
          }}
        />
      )}

      {filters.map((filter) => (
        <Select
          key={filter.key}
          label={filter.label}
          selectedKeys={filter.value ? [filter.value] : []}
          onSelectionChange={(keys) => {
            const selected = Array.from(keys)[0] as string;
            filter.onChange(selected || '');
          }}
          classNames={{
            base: 'max-w-[150px]',
            trigger: 'bg-content1 border border-white/5 h-10',
          }}
          size="sm"
        >
          {filter.options.map((option) => (
            <SelectItem key={option.key}>{option.label}</SelectItem>
          ))}
        </Select>
      ))}

      {children}

      {showClearButton && hasActiveFilters && onClear && (
        <Button
          variant="flat"
          size="sm"
          onPress={onClear}
          startContent={<Icon.Close className="w-3 h-3" />}
        >
          Clear Filters
        </Button>
      )}
    </div>
  );
}
