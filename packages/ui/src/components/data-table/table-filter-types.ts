export interface TableFilterOption {
  label: string;
  value: string;
}

export type TableFilterDefinition =
  | {
      id: string;
      columnId: string;
      label: string;
      type: "text";
      placeholder?: string;
    }
  | {
      id: string;
      columnId: string;
      label: string;
      type: "enum";
      options: TableFilterOption[];
    };

export function formatEnumLabel(value: string): string {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function enumOptionsFromValues(
  values: readonly string[]
): TableFilterOption[] {
  return values.map((value) => ({
    value,
    label: formatEnumLabel(value),
  }));
}

export function isFilterValueActive(value: unknown): boolean {
  if (value == null) {
    return false;
  }
  if (typeof value === "string") {
    return value.trim().length > 0;
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  return true;
}

export function getColumnFilterValue(
  columnFilters: { id: string; value: unknown }[],
  columnId: string
): unknown {
  return columnFilters.find((filter) => filter.id === columnId)?.value;
}

export function setColumnFilterValue(
  columnFilters: { id: string; value: unknown }[],
  columnId: string,
  value: unknown
): { id: string; value: unknown }[] {
  const without = columnFilters.filter((filter) => filter.id !== columnId);
  if (!isFilterValueActive(value)) {
    return without;
  }
  return [...without, { id: columnId, value }];
}

export function formatFilterChipValue(
  definition: TableFilterDefinition,
  value: unknown
): string {
  if (definition.type === "text" && typeof value === "string") {
    return value;
  }
  if (definition.type === "enum" && Array.isArray(value)) {
    return value
      .map((item) => {
        const option = definition.options.find((opt) => opt.value === item);
        return option?.label ?? formatEnumLabel(String(item));
      })
      .join(", ");
  }
  return String(value);
}

export function countActiveFilters(
  columnFilters: { id: string; value: unknown }[],
  definitions: TableFilterDefinition[]
): number {
  const definitionIds = new Set(definitions.map((def) => def.columnId));
  return columnFilters.filter(
    (filter) =>
      definitionIds.has(filter.id) && isFilterValueActive(filter.value)
  ).length;
}
