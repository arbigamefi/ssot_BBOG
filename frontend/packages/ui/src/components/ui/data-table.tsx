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
    className,
}: DataTableProps<T>) {
    return (
        <div className={cn("rounded-xl border border-slate-800 bg-slate-900/40 backdrop-blur-sm overflow-hidden", className)}>
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-800/50">
                            {columns.map((col) => (
                                <th
                                    key={col.key}
                                    className={cn(
                                        "px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-400",
                                        col.headerClassName
                                    )}
                                >
                                    {col.header}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                        {loading ? (
                            <tr>
                                <td colSpan={columns.length} className="px-4 py-8 text-center text-sm text-slate-500">
                                    <div className="flex items-center justify-center gap-2">
                                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-600 border-t-slate-300" />
                                        Loading…
                                    </div>
                                </td>
                            </tr>
                        ) : data.length === 0 ? (
                            <tr>
                                <td colSpan={columns.length} className="px-4 py-8 text-center text-sm text-slate-500">
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
                                        "hover:bg-slate-800/40"
                                    )}
                                >
                                    {columns.map((col) => (
                                        <td
                                            key={col.key}
                                            className={cn("px-4 py-3 text-sm", col.cellClassName)}
                                        >
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
