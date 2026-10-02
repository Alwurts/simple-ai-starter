import {
  type ColumnDef,
  type RowData,
  rowPaginationFeature,
  rowSortingFeature,
  tableFeatures,
} from "@tanstack/react-table";

/**
 * Server tables only. Sorting and pagination stay manual, so the client
 * row models (filter, sort, page, selection, column visibility) are omitted.
 */
export const dataTableFeatures = tableFeatures({
  rowPaginationFeature,
  rowSortingFeature,
});

export type DataTableFeatures = typeof dataTableFeatures;

export type DataTableColumnDef<
  TData extends RowData,
  TValue = unknown,
> = ColumnDef<DataTableFeatures, TData, TValue>;
