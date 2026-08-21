"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { WorkoutLevel } from "@/lib/types";
import { FormField, NumberInput, Textarea, TextInput, Toggle } from "@/components/ui/fields";
import { FormSection } from "@/components/ui/feedback";
import { ImageUpload } from "@/components/ui/image-upload";
import { FormPage, slugFromName } from "@/components/forms/form-page";
import { ApiError, apiUpload } from "@/lib/api-client";
import {
  createWorkoutLevel,
  updateWorkoutLevel,
  validateWorkoutLevelForm,
  workoutLevelFormToApiPayload,
} from "@/lib/workout-levels-api";

export function WorkoutLevelForm({
  mode,
  initial,
}: {
  mode: "create" | "edit";
  initial?: WorkoutLevel;
}) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [sortOrder, setSortOrder] = useState(String(initial?.sortOrder ?? 0));
  const [active, setActive] = useState(initial?.active ?? true);
  const [image, setImage] = useState<string | null>(initial?.image ?? null);
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageError, setImageError] = useState("");
  const [error, setError] = useState("");

  async function handleImageFile(file: File) {
    setUploadingImage(true);
    setImageError("");
    try {
      const result = await apiUpload<{ url: string }>("/api/admin/media/upload", file, {
        folder: "workout-levels",
      });
      setImage(result.url);
    } catch (err) {
      setImageError(err instanceof ApiError ? err.message : "Image upload failed");
    } finally {
      setUploadingImage(false);
    }
  }

  async function handleSubmit() {
    const form = { name, slug, description, sortOrder, active, image };
    const errors = validateWorkoutLevelForm(form);
    if (Object.keys(errors).length > 0) {
      setError(Object.values(errors)[0] ?? "Please fix the form errors");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const payload = workoutLevelFormToApiPayload(form);
      if (mode === "create") await createWorkoutLevel(payload);
      else if (initial) await updateWorkoutLevel(initial.id, payload);
      router.push("/admin/workout/levels?created=1");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save workout level");
    } finally {
      setLoading(false);
    }
  }

  return (
    <FormPage
      title={mode === "create" ? "Add Workout Level" : "Edit Workout Level"}
      subtitle="Fill in English. All 15 languages are generated automatically on save."
      backHref="/admin/workout/levels"
      backLabel="Back to Workout Levels"
      submitLabel={mode === "create" ? "Create Level" : "Save Changes"}
      loading={loading}
      error={error}
      dataResource="workout-levels"
      onSubmit={() => void handleSubmit()}
    >
      <FormSection title="Basic information">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField label="Name" required>
            <TextInput
              value={name}
              placeholder="Beginner"
              onChange={(event) => {
                const next = event.target.value;
                setName(next);
                if (mode === "create") {
                  const generated = slugFromName(next);
                  if (generated) setSlug(generated);
                }
              }}
            />
          </FormField>
          <FormField label="Slug" required>
            <TextInput
              value={slug}
              placeholder="beginner"
              onChange={(event) => setSlug(event.target.value)}
            />
          </FormField>
        </div>
        <FormField label="Description">
          <Textarea
            value={description}
            placeholder="Foundational movements with low impact."
            onChange={(event) => setDescription(event.target.value)}
          />
        </FormField>
      </FormSection>

      <FormSection title="Settings">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField label="Sort Order">
            <NumberInput value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} />
          </FormField>
          <FormField label="Status">
            <div className="flex h-9 items-center">
              <Toggle checked={active} onChange={setActive} label={active ? "Active" : "Inactive"} />
            </div>
          </FormField>
        </div>
      </FormSection>

      <FormSection title="Image">
        <ImageUpload
          value={image}
          uploading={uploadingImage}
          error={imageError}
          onUrlChange={setImage}
          onFileSelect={(file) => void handleImageFile(file)}
        />
      </FormSection>
    </FormPage>
  );
}
