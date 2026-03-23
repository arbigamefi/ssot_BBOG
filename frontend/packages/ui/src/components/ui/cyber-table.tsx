import * as React from "react";
import { cn } from "../../lib/utils";

export type CyberTableColumn<T> = {
  key: string;
  header: React.ReactNode;
  render: (row: T, index: number) => React.ReactNode;
  headerClassName?: string;
  cellClassName?: string;
};

export type CyberTableProps<T> = {
  columns: CyberTableColumn<T>[];
  data: T[];
  /** Standard CSS grid-template-columns string, e.g. "1.5fr 1.5fr 1fr 1fr 1fr 100px" */
  gridCols?: string; 
  rowKey?: (row: T, index: number) => string | number;
  onRowClick?: (row: T, index: number) => void;
  loading?: boolean;
  emptyMessage?: string;
  className?: string;
  /** Custom ring color on hover, e.g. "hover:border-green-500/40 hover:shadow-[0_0_25px_rgba(34,197,94,0.1)]" */
  hoverEffectClass?: string;
};

export function CyberTable<T>({
  columns,
  data,
  gridCols = "repeat(auto-fit, minmax(0, 1fr))",
  rowKey,
  onRowClick,
  loading,
  emptyMessage = "NO DATA FOUND",
  className,
  hoverEffectClass = "hover:bg-[#0a0a0a] hover:border-white/20 hover:shadow-[0_0_25px_rgba(255,255,255,0.05)]"
}: CyberTableProps<T>) {
  return (
    <div className={cn("flex flex-col gap-3 w-full", className)}>
      
      {/* Header Row */}
      <div 
        className="px-4 py-2 opacity-50 hidden sm:grid items-center gap-4"
        style={{ gridTemplateColumns: gridCols }}
      >
        {columns.map((col) => (
          <div 
            key={col.key} 
            className={cn("text-[10px] font-bold uppercase tracking-widest text-white/50", col.headerClassName)}
          >
             {col.header}
          </div>
        ))}
      </div>

      {/* Body Rows */}
      <div className="flex flex-col gap-3">
        {loading ? (
          <div className="rounded-[1.5rem] border border-white/5 bg-[#050505] p-10 flex items-center justify-center">
            <span className="text-white/30 font-mono tracking-widest uppercase text-xs animate-pulse">Scanning Ledger...</span>
          </div>
        ) : data.length === 0 ? (
          <div className="rounded-[1.5rem] border border-white/5 bg-[#050505] p-10 flex flex-col items-center justify-center text-center">
             <div className="text-white/20 font-mono text-sm tracking-tighter uppercase">{emptyMessage}</div>
          </div>
        ) : (
          data.map((row, idx) => (
            <div
              key={rowKey ? rowKey(row, idx) : idx}
              onClick={() => onRowClick?.(row, idx)}
              className={cn(
                "rounded-[1.5rem] border border-white/5 bg-[#050505] p-4 transition-all group",
                onRowClick && "cursor-pointer",
                hoverEffectClass
              )}
            >
              <div 
                className="grid items-center gap-4"
                style={{ gridTemplateColumns: gridCols }}
              >
                {columns.map((col) => (
                  <div key={col.key} className={cn("flex flex-col justify-center", col.cellClassName)}>
                    {col.render(row, idx)}
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
