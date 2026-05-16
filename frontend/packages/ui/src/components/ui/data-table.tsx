import * as React from "react";
import { cn } from "../../lib/utils";

export type DataTableColumn<T> = {
  key: string;
  header: string;
  /** Render cell content. Receives the row data. */
  render: (row: T, index: number) => React.ReactNode;
  /** Optional custom header class */
  headerClassName?: string;
  /** Optional custom cell class */
  cellClassName?: string;
};

export type DataTableProps<T> = {
  columns: DataTableColumn<T>[];
  data: T[];
  /** Unique key extractor — defaults to index */
  rowKey?: (row: T, index: number) => string | number;
  onRowClick?: (row: T, index: number) => void;
  loading?: boolean;
  emptyMessage?: string;
  className?: string;
};

/**
 * Dark-themed data table with hover highlight, rounded container,
 * and optional row click handler. Replaces all raw <table> elements.
 */
export function DataTable<T>({
  columns,
  data,
  rowKey,
  onRowClick,
  loading,
  emptyMessage = "No data available.",
  className
}: DataTableProps<T>) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-surface-1 shadow-e1",
        className
      )}
    >
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="bg-surface-2">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    "px-4 py-3 text-xs font-medium uppercase tracking-wider text-fg-subtle",
                    col.headerClassName
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border-soft">
            {loading ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-8 text-center text-sm text-fg-subtle"
                >
                  <div className="flex items-center justify-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-fg-muted" />
                    Loading...
                  </div>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-8 text-center text-sm text-fg-subtle"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row, idx) => (
                <tr
                  key={rowKey ? rowKey(row, idx) : idx}
                  onClick={() => onRowClick?.(row, idx)}
                  className={cn(
                    "transition-colors",
                    onRowClick && "cursor-pointer",
                    "hover:bg-surface-2"
                  )}
                >
                  {columns.map((col) => (
                    <td key={col.key} className={cn("px-4 py-3 text-sm", col.cellClassName)}>
                      {col.render(row, idx)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
