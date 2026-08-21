"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { MealForm } from "@/components/forms/meal-form";
import { Icon } from "@/components/ui/icon";
import { ApiError } from "@/lib/api-client";
import { fetchMeal, mealDocumentToUi } from "@/lib/meals-api";
import type { Meal } from "@/lib/types";

function EditMealSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-[920px] flex-col gap-4">
      <div className="rounded-[16px] border border-[var(--border)] bg-[var(--card-bg)] px-5 py-5">
        <div className="mb-3 h-3 w-24 animate-pulse rounded bg-[var(--black-05)]" />
        <div className="h-6 w-40 animate-pulse rounded bg-[var(--black-05)]" />
        <div className="mt-2 h-4 w-64 animate-pulse rounded bg-[var(--black-05)]" />
      </div>
      <div className="overflow-hidden rounded-[16px] border border-[var(--border)] bg-[var(--card-bg)] p-6">
        <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
          <div className="aspect-square animate-pulse rounded-[16px] bg-[var(--black-05)]" />
          <div className="flex flex-col gap-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-9 animate-pulse rounded-[8px] bg-[var(--black-05)]" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function EditMealPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [meal, setMeal] = useState<Meal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError("");
      try {
        const doc = await fetchMeal(params.id);
        setMeal(mealDocumentToUi(doc));
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          router.replace("/admin/meal/meals");
          return;
        }
        setError(err instanceof ApiError ? err.message : "Failed to load meal");
      } finally {
        setLoading(false);
      }
    })();
  }, [params.id, router]);

  if (loading) {
    return <EditMealSkeleton />;
  }

  if (error || !meal) {
    return (
      <div className="mx-auto flex max-w-[920px] items-start gap-2 rounded-[12px] border border-[rgb(255_71_71/0.25)] bg-[rgb(255_71_71/0.08)] px-4 py-3 text-[13px] text-[var(--bright-red)]">
        <Icon name="warning" size={16} className="mt-0.5 shrink-0" />
        <span>{error || "Meal not found"}</span>
      </div>
    );
  }

  return <MealForm mode="edit" initial={meal} />;
}
