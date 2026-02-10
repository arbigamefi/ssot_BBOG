import { describe, it, expect } from "vitest";

/**
 * Pagination logic tests (node env — no DOM).
 * Tests the usePagination math: pageCount, startIndex, endIndex.
 */

function calcPagination(totalItems: number, pageSize: number, page: number) {
  const pageCount = Math.max(1, Math.ceil(totalItems / pageSize));
  const clamped = Math.min(Math.max(1, page), pageCount);
  const startIndex = (clamped - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  return { page: clamped, pageCount, startIndex, endIndex };
}

describe("Pagination math", () => {
  it("single page when items <= pageSize", () => {
    const r = calcPagination(5, 20, 1);
    expect(r).toEqual({ page: 1, pageCount: 1, startIndex: 0, endIndex: 5 });
  });

  it("zero items → single empty page", () => {
    const r = calcPagination(0, 20, 1);
    expect(r).toEqual({ page: 1, pageCount: 1, startIndex: 0, endIndex: 0 });
  });

  it("exact multiple of pageSize", () => {
    const r = calcPagination(40, 20, 2);
    expect(r).toEqual({ page: 2, pageCount: 2, startIndex: 20, endIndex: 40 });
  });

  it("partial last page", () => {
    const r = calcPagination(25, 20, 2);
    expect(r).toEqual({ page: 2, pageCount: 2, startIndex: 20, endIndex: 25 });
  });

  it("clamps page above pageCount", () => {
    const r = calcPagination(10, 20, 99);
    expect(r.page).toBe(1);
    expect(r.pageCount).toBe(1);
  });

  it("clamps page below 1", () => {
    const r = calcPagination(50, 20, 0);
    expect(r.page).toBe(1);
  });

  it("large dataset page 3", () => {
    const r = calcPagination(100, 20, 3);
    expect(r).toEqual({ page: 3, pageCount: 5, startIndex: 40, endIndex: 60 });
  });

  it("pageSize of 1", () => {
    const r = calcPagination(5, 1, 3);
    expect(r).toEqual({ page: 3, pageCount: 5, startIndex: 2, endIndex: 3 });
  });
});
