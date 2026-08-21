"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { WorkoutCategoryForm } from "@/components/forms/workout-category-form";
import { ApiError } from "@/lib/api-client";
import { fetchWorkoutCategory, workoutCategoryDocumentToUi } from "@/lib/workout-categories-api";
import type { WorkoutCategory } from "@/lib/types";

export default function EditWorkoutCategoryPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [item, setItem] = useState<WorkoutCategory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const doc = await fetchWorkoutCategory(params.id);
        setItem(workoutCategoryDocumentToUi(doc));
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          router.replace("/admin/workout/categories");
          return;
        }
        setError(err instanceof ApiError ? err.message : "Failed to load category");
      } finally {
        setLoading(false);
      }
    })();
  }, [params.id, router]);

  if (loading) return <p className="text-[13px] text-[var(--text-muted)]">Loading category...</p>;
  if (error || !item) return <p className="text-[13px] text-[var(--bright-red)]">{error || "Not found"}</p>;
  return <WorkoutCategoryForm mode="edit" initial={item} />;
}
