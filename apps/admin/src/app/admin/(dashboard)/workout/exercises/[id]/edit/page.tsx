"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ExerciseForm } from "@/components/forms/exercise-form";
import { ApiError } from "@/lib/api-client";
import { exerciseDocumentToUi, fetchExercise } from "@/lib/exercises-api";
import type { Exercise } from "@/lib/types";

export default function EditExercisePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [item, setItem] = useState<Exercise | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const doc = await fetchExercise(params.id);
        setItem(exerciseDocumentToUi(doc));
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          router.replace("/admin/workout/exercises");
          return;
        }
        setError(err instanceof ApiError ? err.message : "Failed to load exercise");
      } finally {
        setLoading(false);
      }
    })();
  }, [params.id, router]);

  if (loading) return <p className="text-[13px] text-[var(--text-muted)]">Loading exercise...</p>;
  if (error || !item) return <p className="text-[13px] text-[var(--bright-red)]">{error || "Not found"}</p>;
  return <ExerciseForm mode="edit" initial={item} />;
}
