"use client";

import * as React from "react";
import { cn } from "../../lib/utils";

export interface PaginationProps {
  /** Current page (1-indexed). */
  page: number;
  /** Total number of pages. */
  pageCount: number;
  /** Callback when user navigates to a different page. */
  onPageChange: (page: number) => void;
  /** Extra class names on the wrapper. */
  className?: string;
}

/**
 * Minimal pagination control — prev/next buttons + page indicator.
 * Renders nothing when `pageCount <= 1`.
 */
export function Pagination({ page, pageCount, onPageChange, className }: PaginationProps) {
  if (pageCount <= 1) return null;

  return (
    <nav
      className={cn("flex items-center justify-center gap-2", className)}
      aria-label="Pagination"
      data-testid="pagination"
    >
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        className={cn(
          "inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium transition-colors",
          "hover:bg-accent hover:text-accent-foreground",
          "disabled:pointer-events-none disabled:opacity-50",
        )}
        aria-label="Previous page"
        data-testid="pagination-prev"
      >
        <svg className="mr-1 h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        Prev
      </button>

      <span className="text-sm text-muted-foreground" data-testid="pagination-info">
        {page} / {pageCount}
      </span>

      <button
        type="button"
        disabled={page >= pageCount}
        onClick={() => onPageChange(page + 1)}
        className={cn(
          "inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium transition-colors",
          "hover:bg-accent hover:text-accent-foreground",
          "disabled:pointer-events-none disabled:opacity-50",
        )}
        aria-label="Next page"
        data-testid="pagination-next"
      >
        Next
        <svg className="ml-1 h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      </button>
    </nav>
  );
}

// ——— Hook for easy page state management ———

export interface UsePaginationOptions {
  /** Total number of items. */
  totalItems: number;
  /** Items per page (default: 20). */
  pageSize?: number;
}

export interface UsePaginationResult {
  /** Current page (1-indexed). */
  page: number;
  /** Total number of pages. */
  pageCount: number;
  /** Set current page. */
  setPage: React.Dispatch<React.SetStateAction<number>>;
  /** Slice start index (0-indexed). */
  startIndex: number;
  /** Slice end index (exclusive). */
  endIndex: number;
}

/**
 * Hook to manage pagination state with automatic clamping.
 * Returns page, pageCount, startIndex, endIndex for slicing arrays.
 */
export function usePagination({ totalItems, pageSize = 20 }: UsePaginationOptions): UsePaginationResult {
  const [page, setPage] = React.useState(1);
  const pageCount = Math.max(1, Math.ceil(totalItems / pageSize));

  // Clamp page when totalItems shrinks
  React.useEffect(() => {
    setPage((p) => Math.min(p, pageCount));
  }, [pageCount]);

  const startIndex = (page - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);

  return { page, pageCount, setPage, startIndex, endIndex };
}
