import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import type {
  ColumnFiltersState,
  PaginationState,
  SortingState,
  Updater,
} from "@tanstack/react-table";
import {
  ShellContent,
  ShellHeader,
  ShellHeaderActions,
  ShellHeaderSidebarTrigger,
  ShellPage,
} from "@workspace/ui/components/brand/shell";
import type { DataTableColumnDef } from "@workspace/ui/components/data-table/data-table-features";
import { ResourceTable } from "@workspace/ui/components/data-table/resource-table";
import { SortableHeader } from "@workspace/ui/components/data-table/sortable-header";
import {
  getColumnFilterValue,
  type TableFilterDefinition,
} from "@workspace/ui/components/data-table/table-filter-types";
import { DEFAULT_CURRENCY, formatMoneyMinor } from "@workspace/ui/lib/money";
import { useCallback, useMemo } from "react";
import { CreateProductDialog } from "@/components/catalog/create-product-dialog";
import { AppBreadcrumbs } from "@/components/layout/app-breadcrumbs";
import { type Product, useProducts } from "@/hooks/catalog/use-products";
import { INTL_LOCALE } from "@/lib/locale";

function productFilterDefinitions(): TableFilterDefinition[] {
  return [
    {
      id: "search",
      columnId: "search",
      label: "Search",
      type: "text",
      placeholder: "Search products…",
    },
  ];
}

function resolveCollectionEmpty({
  isTrueEmpty,
  isPresetEmpty,
}: {
  isTrueEmpty: boolean;
  isPresetEmpty: boolean;
}) {
  if (isTrueEmpty) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
        <p className="font-medium text-sm">No products yet</p>
        <p className="text-muted-foreground text-sm">
          Create a product to populate the catalog.
        </p>
      </div>
    );
  }

  if (isPresetEmpty) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
        <p className="font-medium text-sm">No products match these filters</p>
      </div>
    );
  }
}

export function CatalogPage() {
  const searchParams = useSearch({ from: "/_protected/_org/catalog/" });
  const navigate = useNavigate({ from: "/catalog/" });
  const { data: productsResponse, isLoading } = useProducts(searchParams);

  const pagination = useMemo<PaginationState>(
    () => ({
      pageIndex: searchParams.page - 1,
      pageSize: searchParams.pageSize,
    }),
    [searchParams.page, searchParams.pageSize]
  );

  const onPaginationChange = useCallback(
    (updater: Updater<PaginationState>) => {
      const next =
        typeof updater === "function" ? updater(pagination) : updater;
      navigate({
        search: (prev) => ({
          ...prev,
          page: next.pageIndex + 1,
          pageSize: next.pageSize,
        }),
      });
    },
    [navigate, pagination]
  );

  const sorting = useMemo<SortingState>(
    () =>
      searchParams.sortBy
        ? [
            {
              id: searchParams.sortBy,
              desc: searchParams.sortOrder === "desc",
            },
          ]
        : [],
    [searchParams.sortBy, searchParams.sortOrder]
  );

  const onSortingChange = useCallback(
    (updater: Updater<SortingState>) => {
      const next = typeof updater === "function" ? updater(sorting) : updater;
      navigate({
        search: (prev) => ({
          ...prev,
          sortBy: next[0]?.id,
          sortOrder: next[0]?.desc ? ("desc" as const) : ("asc" as const),
          page: 1,
        }),
      });
    },
    [navigate, sorting]
  );

  const columnFilters = useMemo<ColumnFiltersState>(
    () =>
      searchParams.search ? [{ id: "search", value: searchParams.search }] : [],
    [searchParams.search]
  );

  const onColumnFiltersChange = useCallback(
    (updater: Updater<ColumnFiltersState>) => {
      const next =
        typeof updater === "function" ? updater(columnFilters) : updater;
      const searchValue = getColumnFilterValue(next, "search");
      navigate({
        search: (prev) => ({
          ...prev,
          search:
            typeof searchValue === "string" && searchValue.trim()
              ? searchValue
              : undefined,
          page: 1,
        }),
      });
    },
    [columnFilters, navigate]
  );

  const pageCount = productsResponse
    ? Math.ceil(productsResponse.total / searchParams.pageSize)
    : 0;

  const hasActiveFilters = Boolean(searchParams.search?.trim());
  const isEmptyResult =
    !(isLoading && !productsResponse) &&
    productsResponse !== undefined &&
    productsResponse.total === 0;
  const collectionEmpty = resolveCollectionEmpty({
    isTrueEmpty: isEmptyResult && !hasActiveFilters,
    isPresetEmpty: isEmptyResult && hasActiveFilters,
  });

  const columns: DataTableColumnDef<Product>[] = [
    {
      id: "name",
      meta: { label: "Name" },
      accessorKey: "name",
      header: ({ column }) => <SortableHeader column={column} />,
      cell: ({ row }) => {
        const product = row.original;
        return (
          <Link
            className="font-medium transition-colors hover:text-primary hover:underline"
            params={{ id: product.id }}
            to="/catalog/$id"
          >
            {product.name}
          </Link>
        );
      },
    },
    {
      id: "price",
      meta: { label: "Price" },
      accessorKey: "price",
      header: ({ column }) => <SortableHeader column={column} />,
      cell: ({ row }) => {
        const price = (row.getValue("price") as number | null) ?? 0;
        return (
          <div className="text-right font-medium">
            {formatMoneyMinor(price, DEFAULT_CURRENCY, {
              locale: INTL_LOCALE,
            })}
          </div>
        );
      },
    },
  ];

  return (
    <ShellPage>
      <ShellHeader>
        <ShellHeaderSidebarTrigger className="-ml-1" />
        <AppBreadcrumbs items={[{ title: "Catalog" }]} />
        <ShellHeaderActions>
          <CreateProductDialog />
        </ShellHeaderActions>
      </ShellHeader>

      <ShellContent>
        {isLoading && !productsResponse ? (
          <div className="flex h-40 items-center justify-center text-muted-foreground">
            Loading products...
          </div>
        ) : (
          <ResourceTable
            collectionEmpty={collectionEmpty}
            columnFilters={columnFilters}
            columns={columns}
            data={productsResponse?.data ?? []}
            embedded
            filterDefinitions={productFilterDefinitions()}
            filteredCount={productsResponse?.total ?? 0}
            onColumnFiltersChange={onColumnFiltersChange}
            onPaginationChange={onPaginationChange}
            onSortingChange={onSortingChange}
            pageCount={pageCount}
            pagination={pagination}
            sorting={sorting}
          />
        )}
      </ShellContent>
    </ShellPage>
  );
}
