"use client";

import {
  type ColumnFiltersState,
  flexRender,
  type OnChangeFn,
  type PaginationState,
  type RowData,
  type SortingState,
  useTable,
} from "@tanstack/react-table";
import {
  type DataTableColumnDef,
  dataTableFeatures,
} from "@workspace/ui/components/data-table/data-table-features";
import { sortAriaSort } from "@workspace/ui/components/data-table/sortable-header";
import { TableFilterToolbar } from "@workspace/ui/components/data-table/table-filter-toolbar";
import type { TableFilterDefinition } from "@workspace/ui/components/data-table/table-filter-types";
import { Button } from "@workspace/ui/components/shadcn/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/shadcn/table";
import { cn } from "@workspace/ui/lib/utils";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import type { ReactNode } from "react";

const FILTER_TOOLBAR_TABLE_GUTTER =
  "[&_tr>*]:px-3 [&_tr>*:first-child]:pl-4 [&_tr>*:last-child]:pr-4";

export interface DataTableProps<TData extends RowData> {
  columns: DataTableColumnDef<TData>[];
  data: TData[];
  pageCount: number;
  pagination: PaginationState;
  onPaginationChange: OnChangeFn<PaginationState>;
  sorting: SortingState;
  onSortingChange: OnChangeFn<SortingState>;
  filterDefinitions: TableFilterDefinition[];
  columnFilters: ColumnFiltersState;
  onColumnFiltersChange: OnChangeFn<ColumnFiltersState>;
  filteredCount: number;
  totalCount?: number;
  onRowClick?: (row: TData) => void;
  /** Inside `ShellContent` — no outer border on the table chrome. */
  embedded?: boolean;
  className?: string;
  /** Rich empty UI. Keeps the filter toolbar visible. */
  collectionEmpty?: ReactNode;
  emptyMessage?: string;
  filteredEmptyMessage?: string;
}

export function DataTable<TData extends RowData>({
  columns,
  data,
  pageCount,
  pagination,
  onPaginationChange,
  sorting,
  onSortingChange,
  filterDefinitions,
  columnFilters,
  onColumnFiltersChange,
  filteredCount,
  totalCount,
  onRowClick,
  embedded = false,
  className,
  collectionEmpty,
  emptyMessage = "No results.",
  filteredEmptyMessage = "No rows match your filters.",
}: DataTableProps<TData>) {
  const table = useTable({
    features: dataTableFeatures,
    data,
    columns,
    manualPagination: true,
    manualSorting: true,
    pageCount,
    state: { pagination, sorting },
    onPaginationChange,
    onSortingChange,
  });
  const hasFilters = columnFilters.length > 0;
  const showCollectionEmpty = filteredCount === 0 && collectionEmpty != null;
  const rows = table.getRowModel().rows;
  const toolbarTotal = totalCount ?? filteredCount;

  return (
    <div
      className={cn(
        "flex min-h-0 flex-col",
        !embedded && "rounded-md border",
        className
      )}
      data-slot="data-table"
    >
      <div className="shrink-0">
        <TableFilterToolbar
          columnFilters={columnFilters}
          definitions={filterDefinitions}
          filteredCount={filteredCount}
          onColumnFiltersChange={onColumnFiltersChange}
          totalCount={toolbarTotal}
        />
      </div>

      {showCollectionEmpty ? (
        <div
          className={cn(
            "flex min-h-0 flex-1 flex-col",
            FILTER_TOOLBAR_TABLE_GUTTER
          )}
          data-slot="data-table-collection-empty"
        >
          {collectionEmpty}
        </div>
      ) : (
        <div
          className={cn(
            "min-h-0 flex-1 overflow-auto",
            FILTER_TOOLBAR_TABLE_GUTTER
          )}
        >
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    const sorted = header.column.getIsSorted();
                    return (
                      <TableHead
                        aria-sort={sortAriaSort(sorted)}
                        className={cn(sorted && "bg-muted/40")}
                        key={header.id}
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    className="h-24 text-center text-muted-foreground"
                    colSpan={columns.length}
                  >
                    {hasFilters ? filteredEmptyMessage : emptyMessage}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow
                    className={onRowClick ? "cursor-pointer" : undefined}
                    key={row.id}
                    onClick={
                      onRowClick ? () => onRowClick(row.original) : undefined
                    }
                  >
                    {row.getAllCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {showCollectionEmpty ? null : (
        <div className="flex shrink-0 items-center justify-end gap-2 border-t px-4 py-3">
          <div className="flex-1 text-muted-foreground text-sm tabular-nums">
            {`Page ${pagination.pageIndex + 1} of ${Math.max(pageCount, 1)}`}
          </div>
          <div className="flex items-center gap-1">
            <Button
              aria-label="Previous page"
              className="size-7"
              disabled={!table.getCanPreviousPage()}
              onClick={() => table.previousPage()}
              size="icon"
              type="button"
              variant="outline"
            >
              <ChevronLeftIcon className="size-4" />
            </Button>
            <Button
              aria-label="Next page"
              className="size-7"
              disabled={!table.getCanNextPage()}
              onClick={() => table.nextPage()}
              size="icon"
              type="button"
              variant="outline"
            >
              <ChevronRightIcon className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
