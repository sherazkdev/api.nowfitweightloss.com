"use client";

import { useCallback, useState } from "react";
import { useDeferredEffect } from "@/lib/use-deferred-effect";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/badges";
import { IdCell, NameCell } from "@/components/ui/cells";
import { EmptyState } from "@/components/ui/feedback";
import { DataActionBar } from "@/components/data/data-action-bar";
import { PrimaryLink } from "@/components/ui/buttons";
import { Icon } from "@/components/ui/icon";
import { ApiError } from "@/lib/api-client";
import { adminPath } from "@/lib/admin-path";
import { deleteMealCategory, fetchMealCategoriesAdmin } from "@/lib/meal-categories-api";
import type { MealCategory } from "@/lib/types";

export default function MealCategoriesPage() {
  const [rows, setRows] = useState<MealCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadCategories = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      setRows(await fetchMealCategoriesAdmin());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load categories");
      setRows([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useDeferredEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[18px] font-semibold leading-7 tracking-tight">Meal Categories</h1>
          <p className="text-[13px] leading-5 text-[var(--text-muted)]">
            Organize meals into browsable categories.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DataActionBar
            variant="toolbar"
            resource="meal-categories"
            addHref="/admin/meal/categories/new"
            addLabel="Add Category"
            refreshing={loading || refreshing}
            onRefresh={() => void loadCategories(true)}
          />
        </div>
      </div>

      {error ? (
        <div className="flex items-start gap-2 rounded-[12px] border border-[rgb(255_71_71/0.25)] bg-[rgb(255_71_71/0.08)] px-4 py-3 text-[13px] text-[var(--bright-red)]">
          <Icon name="warning" size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {!loading && rows.length === 0 && !error ? (
        <div className="min-h-[280px] rounded-[16px] border border-[var(--border)] bg-[var(--card-bg)]">
          <EmptyState
            title="No categories yet"
            description="Create a category or import sample data from Raw Upload."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <PrimaryLink href="/admin/meal/categories/new">Add Category</PrimaryLink>
                <PrimaryLink href="/admin/data/raw-upload?resource=meal-categories">Raw Upload</PrimaryLink>
              </div>
            }
          />
        </div>
      ) : (
        <div className="rounded-[16px] border border-[var(--border)] bg-[var(--card-bg)] p-2 sm:p-3">
          <DataTable
            title=""
            resourceLabel="Meal Category"
            rows={rows}
            loading={loading}
            getRowId={(row) => row.id}
            getRowName={(row) => row.name}
            addHref="/admin/meal/categories/new"
            addLabel="Add Category"
            showAdd={false}
            showReorder
            searchPlaceholder="Search categories"
            editHref={(row) => adminPath(`/meal/categories/${row.id}/edit`)}
            onDelete={async (row) => {
              await deleteMealCategory(row.id);
              await loadCategories(true);
            }}
            columns={[
              {
                key: "id",
                header: "ID",
                render: (row) => <IdCell value={`#${row.id}`} />,
              },
              { key: "name", header: "Name", render: (row) => <NameCell name={row.name} icon={row.icon} /> },
              { key: "slug", header: "Slug", render: (row) => row.slug },
              { key: "sort", header: "Sort", render: (row) => row.sortOrder },
              { key: "status", header: "Status", render: (row) => <StatusBadge active={row.active} /> },
            ]}
          />
        </div>
      )}
    </div>
  );
}
