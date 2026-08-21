"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { WorkoutLevelForm } from "@/components/forms/workout-level-form";
import { ApiError } from "@/lib/api-client";
import { fetchWorkoutLevel, workoutLevelDocumentToUi } from "@/lib/workout-levels-api";
import type { WorkoutLevel } from "@/lib/types";

export default function EditWorkoutLevelPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [item, setItem] = useState<WorkoutLevel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const doc = await fetchWorkoutLevel(params.id);
        setItem(workoutLevelDocumentToUi(doc));
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          router.replace("/admin/workout/levels");
          return;
        }
        setError(err instanceof ApiError ? err.message : "Failed to load level");
      } finally {
        setLoading(false);
      }
    })();
  }, [params.id, router]);

  if (loading) return <p className="text-[13px] text-[var(--text-muted)]">Loading level...</p>;
  if (error || !item) return <p className="text-[13px] text-[var(--bright-red)]">{error || "Not found"}</p>;
  return <WorkoutLevelForm mode="edit" initial={item} />;
}
