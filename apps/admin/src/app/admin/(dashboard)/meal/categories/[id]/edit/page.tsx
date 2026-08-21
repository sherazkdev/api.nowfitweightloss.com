"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { MealCategoryForm } from "@/components/forms/meal-category-form";
import { Icon } from "@/components/ui/icon";
import { ApiError } from "@/lib/api-client";
import { fetchMealCategory, mealCategoryDocumentToUi } from "@/lib/meal-categories-api";
import type { MealCategory } from "@/lib/types";

export default function EditMealCategoryPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [category, setCategory] = useState<MealCategory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError("");
      try {
        const doc = await fetchMealCategory(params.id);
        setCategory(mealCategoryDocumentToUi(doc));
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          router.replace("/admin/meal/categories");
          return;
        }
        setError(err instanceof ApiError ? err.message : "Failed to load category");
      } finally {
        setLoading(false);
      }
    })();
  }, [params.id, router]);

  if (loading) {
    return <div className="mx-auto max-w-[720px] py-8 text-[13px] text-[var(--text-muted)]">Loading category...</div>;
  }

  if (error || !category) {
    return (
      <div className="mx-auto flex max-w-[720px] items-start gap-2 rounded-[12px] border border-[rgb(255_71_71/0.25)] bg-[rgb(255_71_71/0.08)] px-4 py-3 text-[13px] text-[var(--bright-red)]">
        <Icon name="warning" size={16} className="mt-0.5 shrink-0" />
        <span>{error || "Category not found"}</span>
      </div>
    );
  }

  return <MealCategoryForm mode="edit" initial={category} />;
}
