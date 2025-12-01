import { ReactNode } from 'react';
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Pagination,
} from '@heroui/react';
import { LoadingState } from './LoadingState';
import { EmptyState } from './EmptyState';

interface Column<T> {
  key: string;
  label: string;
  width?: number;
  render?: (item: T) => ReactNode;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  loading?: boolean;
  emptyMessage?: string;
  pagination?: {
    page: number;
    totalPages: number;
    onPageChange: (page: number) => void;
  };
  onRowClick?: (item: T) => void;
  className?: string;
}

export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  loading = false,
  emptyMessage = 'No data found',
  pagination,
  onRowClick,
  className = '',
}: DataTableProps<T>) {
  if (loading) {
    return <LoadingState />;
  }

  if (data.length === 0) {
    return <EmptyState title={emptyMessage} />;
  }

  return (
    <div className={className}>
      <div className="bg-content1 border border-white/5 rounded-xl overflow-hidden">
        <Table
          aria-label="Data table"
          removeWrapper
          classNames={{
            th: 'bg-content2 text-foreground/70 font-medium text-xs',
            td: 'text-foreground/90 text-sm',
          }}
        >
          <TableHeader>
            {columns.map((column) => (
              <TableColumn key={column.key} width={column.width}>
                {column.label}
              </TableColumn>
            ))}
          </TableHeader>
          <TableBody>
            {data.map((item, index) => (
              <TableRow
                key={item.id || index}
                className={onRowClick ? 'cursor-pointer hover:bg-content2 transition-colors' : ''}
                onClick={() => onRowClick?.(item)}
              >
                {columns.map((column) => (
                  <TableCell key={column.key}>
                    {column.render ? column.render(item) : item[column.key]}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {pagination && pagination.totalPages > 1 && (
        <div className="flex justify-center mt-6">
          <Pagination
            total={pagination.totalPages}
            page={pagination.page}
            onChange={pagination.onPageChange}
            showControls
            classNames={{
              item: 'bg-content1 hover:bg-content2',
              cursor: 'bg-primary text-background',
            }}
          />
        </div>
      )}
    </div>
  );
}
