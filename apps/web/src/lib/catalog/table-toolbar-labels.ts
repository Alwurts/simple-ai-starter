import type {
  SortAriaLabelFn,
  SortDirection,
} from "@workspace/ui/components/brand/sortable-header";
import type { TableFilterToolbarLabels } from "@workspace/ui/components/brand/table-filter-toolbar";

export function tableToolbarLabels(): TableFilterToolbarLabels {
  return {
    filters: "Filters",
    filtersActive: (count) => `Filters (${count} active)`,
    clearAll: "Clear all",
    removeFilter: (label) => `Remove ${label} filter`,
    row: "row",
    rows: "rows",
    rowsOf: (filtered, total) => `${filtered} of ${total}`,
    pageOf: (page, total) => `Page ${page} of ${total}`,
    sort: {
      sort: "Sort",
      sortBy: "Sort by",
      clear: "Clear",
      ascending: "Ascending",
      descending: "Descending",
      sortedByAria: (column, direction) =>
        `Sorted by ${column}, ${
          direction === "asc" ? "Ascending" : "Descending"
        }. Change sort.`,
    },
  };
}

/** Aria labels for `SortableHeader`. */
export const sortableHeaderAriaLabel: SortAriaLabelFn = (
  label: string,
  sorted: SortDirection
) => {
  if (sorted === "asc") {
    return `Sorted by ${label}, ascending. Click to sort descending.`;
  }
  if (sorted === "desc") {
    return `Sorted by ${label}, descending. Click to sort ascending.`;
  }
  return `Sort by ${label}`;
};
