import type { PaginationQuery } from "@workspace/contract/pagination";

/**
 * The outbound page envelope for list endpoints. Outbound shapes are inferred
 * from the implementation (ADR-004) — this interface is the implementation's
 * own return contract, not a boundary schema.
 */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export function getPaginationOffsetLimit(
  params: Pick<PaginationQuery, "page" | "pageSize">
) {
  const offset = (params.page - 1) * params.pageSize;
  return { offset, limit: params.pageSize };
}

export function buildPaginatedResponse<T>(
  data: T[],
  total: number,
  params: Pick<PaginationQuery, "page" | "pageSize">
): PaginatedResponse<T> {
  return {
    data,
    total,
    page: params.page,
    pageSize: params.pageSize,
  };
}
