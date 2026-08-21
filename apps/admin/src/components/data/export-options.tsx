"use client";

import { Checkbox, FormField, Select } from "@/components/ui/fields";
import { cn } from "@/lib/cn";
import type { DataResourceDef } from "@/lib/data-resources";

export type ExportScope = "all" | "active" | "inactive" | "challenge";

export type ExportFilters = {
  scope: ExportScope;
  gender: string;
  category: string;
  workoutLevel: string;
  workoutCategory: string;
};

export type ExportFilterOptions = {
  mealCategories: Array<{ id: string; name: string }>;
  workoutLevels: Array<{ id: string; name: string }>;
  workoutCategories: Array<{ id: string; name: string }>;
};

const scopes: { value: ExportScope; label: string; challenge?: boolean }[] = [
  { value: "all", label: "All Records" },
  { value: "active", label: "Active Only" },
  { value: "inactive", label: "Inactive Only" },
  { value: "challenge", label: "Challenge Content", challenge: true },
];

export function ExportOptions({
  resource,
  filters,
  options,
  onChange,
}: {
  resource: DataResourceDef;
  filters: ExportFilters;
  options: ExportFilterOptions;
  onChange: (next: ExportFilters) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {scopes
          .filter((scope) => !scope.challenge || resource.hasChallenge)
          .map((scope) => {
            const selected = filters.scope === scope.value;
            return (
              <button
                key={scope.value}
                type="button"
                onClick={() => onChange({ ...filters, scope: scope.value })}
                className={cn(
                  "h-8 rounded-[8px] border px-3 text-[14px] leading-5",
                  selected
                    ? "border-transparent bg-[var(--nav-active-bg)] text-ink"
                    : "border-[var(--border)] text-ink hover:bg-[var(--surface-hover)]",
                )}
              >
                {scope.label}
              </button>
            );
          })}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {resource.hasGender ? (
          <FormField label="Gender">
            <Select
              value={filters.gender}
              onChange={(event) => onChange({ ...filters, gender: event.target.value })}
            >
              <option value="all">All genders</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="both">Both</option>
            </Select>
          </FormField>
        ) : null}
        {resource.hasCategory ? (
          <FormField label="Category">
            <Select
              value={filters.category}
              onChange={(event) => onChange({ ...filters, category: event.target.value })}
            >
              <option value="all">All categories</option>
              {options.mealCategories.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </Select>
          </FormField>
        ) : null}
        {resource.hasWorkoutLevel ? (
          <FormField label="Workout Level">
            <Select
              value={filters.workoutLevel}
              onChange={(event) => onChange({ ...filters, workoutLevel: event.target.value })}
            >
              <option value="all">All levels</option>
              {options.workoutLevels.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </Select>
          </FormField>
        ) : null}
        {resource.hasWorkoutCategory ? (
          <FormField label="Workout Category">
            <Select
              value={filters.workoutCategory}
              onChange={(event) => onChange({ ...filters, workoutCategory: event.target.value })}
            >
              <option value="all">All categories</option>
              {options.workoutCategories.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </Select>
          </FormField>
        ) : null}
      </div>
    </div>
  );
}

export function ExportColumnSelector({
  columns,
  selected,
  onChange,
}: {
  columns: { key: string; label: string }[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
      {columns.map((column) => {
        const checked = selected.includes(column.key);
        return (
          <label
            key={column.key}
            className="flex h-8 cursor-pointer items-center gap-2 rounded-[8px] px-2 hover:bg-[var(--surface-hover)]"
          >
            <Checkbox
              checked={checked}
              onChange={() =>
                onChange(
                  checked ? selected.filter((key) => key !== column.key) : [...selected, column.key],
                )
              }
            />
            <span className="text-[14px] leading-5">{column.label}</span>
          </label>
        );
      })}
    </div>
  );
}

export function exportFiltersToApi(filters: ExportFilters) {
  return {
    scope: filters.scope,
    gender: filters.gender as "all" | "male" | "female" | "both",
    categoryId: filters.category === "all" ? null : Number(filters.category),
    workoutLevelId: filters.workoutLevel === "all" ? null : Number(filters.workoutLevel),
    workoutCategoryId: filters.workoutCategory === "all" ? null : Number(filters.workoutCategory),
  };
}
