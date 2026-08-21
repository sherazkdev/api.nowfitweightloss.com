"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Gender, WorkoutCategory, WorkoutLevel } from "@/lib/types";
import { FormField, NumberInput, Select, Textarea, TextInput, Toggle } from "@/components/ui/fields";
import { FormSection } from "@/components/ui/feedback";
import { ImageUpload } from "@/components/ui/image-upload";
import { FormPage, slugFromName } from "@/components/forms/form-page";
import { MultiSelect } from "@/components/ui/multi-select";
import { ApiError, apiUpload } from "@/lib/api-client";
import {
  createWorkoutCategory,
  updateWorkoutCategory,
  validateWorkoutCategoryForm,
  workoutCategoryFormToApiPayload,
} from "@/lib/workout-categories-api";
import { fetchWorkoutLevelsAdmin } from "@/lib/workout-levels-api";

export function WorkoutCategoryForm({
  mode,
  initial,
}: {
  mode: "create" | "edit";
  initial?: WorkoutCategory;
}) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [levelIds, setLevelIds] = useState<string[]>(initial?.levelIds ?? []);
  const [gender, setGender] = useState<Gender>(initial?.gender ?? "both");
  const [challenge, setChallenge] = useState(initial?.challenge ?? false);
  const [sortOrder, setSortOrder] = useState(String(initial?.sortOrder ?? 0));
  const [active, setActive] = useState(initial?.active ?? true);
  const [image, setImage] = useState<string | null>(initial?.image ?? null);
  const [levels, setLevels] = useState<WorkoutLevel[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingLevels, setLoadingLevels] = useState(true);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageError, setImageError] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        setLevels(await fetchWorkoutLevelsAdmin());
      } catch {
        setLevels([]);
      } finally {
        setLoadingLevels(false);
      }
    })();
  }, []);

  async function handleImageFile(file: File) {
    setUploadingImage(true);
    setImageError("");
    try {
      const result = await apiUpload<{ url: string }>("/api/admin/media/upload", file, {
        folder: "workout-categories",
      });
      setImage(result.url);
    } catch (err) {
      setImageError(err instanceof ApiError ? err.message : "Image upload failed");
    } finally {
      setUploadingImage(false);
    }
  }

  async function handleSubmit() {
    const form = {
      name,
      slug,
      description,
      levelIds,
      gender,
      challenge,
      sortOrder,
      active,
      image,
    };
    const errors = validateWorkoutCategoryForm(form);
    if (Object.keys(errors).length > 0) {
      setError(Object.values(errors)[0] ?? "Please fix the form errors");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const payload = workoutCategoryFormToApiPayload(form);
      if (mode === "create") await createWorkoutCategory(payload);
      else if (initial) await updateWorkoutCategory(initial.id, payload);
      router.push("/admin/workout/categories?created=1");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save workout category");
    } finally {
      setLoading(false);
    }
  }

  return (
    <FormPage
      title={mode === "create" ? "Add Workout Category" : "Edit Workout Category"}
      subtitle="Fill in English. All 15 languages are generated automatically on save."
      backHref="/admin/workout/categories"
      backLabel="Back to Workout Categories"
      submitLabel={mode === "create" ? "Create Category" : "Save Changes"}
      loading={loading}
      error={error}
      dataResource="workout-categories"
      onSubmit={() => void handleSubmit()}
    >
      <FormSection title="Basic information">
        <FormField label="Workout Levels" required>
          <MultiSelect
            value={levelIds}
            onChange={setLevelIds}
            options={levels.map((level) => ({ value: level.id, label: level.name }))}
            placeholder={loadingLevels ? "Loading levels..." : "Select levels"}
          />
        </FormField>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField label="Name" required>
            <TextInput
              value={name}
              placeholder="Full Body"
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
              placeholder="full-body"
              onChange={(event) => setSlug(event.target.value)}
            />
          </FormField>
        </div>
        <FormField label="Description">
          <Textarea
            value={description}
            placeholder="Compound sessions targeting the entire body."
            onChange={(event) => setDescription(event.target.value)}
          />
        </FormField>
      </FormSection>

      <FormSection title="Settings">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <FormField label="Gender">
            <Select value={gender} onChange={(event) => setGender(event.target.value as Gender)}>
              <option value="both">Both</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </Select>
          </FormField>
          <FormField label="Challenge">
            <div className="flex h-9 items-center">
              <Toggle checked={challenge} onChange={setChallenge} label={challenge ? "Yes" : "No"} />
            </div>
          </FormField>
          <FormField label="Sort Order">
            <NumberInput value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} />
          </FormField>
        </div>
        <FormField label="Status">
          <Toggle checked={active} onChange={setActive} label={active ? "Active" : "Inactive"} />
        </FormField>
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
