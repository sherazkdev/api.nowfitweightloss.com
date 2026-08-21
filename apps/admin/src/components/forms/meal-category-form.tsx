"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { MealCategory } from "@/lib/types";
import { FormField, NumberInput, Textarea, TextInput, Toggle } from "@/components/ui/fields";
import { FormSection } from "@/components/ui/feedback";
import { ImageUpload } from "@/components/ui/image-upload";
import { FormPage, slugFromName } from "@/components/forms/form-page";
import { IconPicker } from "@/components/forms/icon-picker";
import { ApiError, apiUpload } from "@/lib/api-client";
import {
  createMealCategory,
  mealCategoryFormToApiPayload,
  updateMealCategory,
  validateMealCategoryForm,
} from "@/lib/meal-categories-api";

export function MealCategoryForm({
  mode,
  initial,
}: {
  mode: "create" | "edit";
  initial?: MealCategory;
}) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [sortOrder, setSortOrder] = useState(String(initial?.sortOrder ?? 0));
  const [active, setActive] = useState(initial?.active ?? true);
  const [icon, setIcon] = useState<string | null>(initial?.icon ?? null);
  const [image, setImage] = useState<string | null>(initial?.image ?? null);
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const [imageError, setImageError] = useState("");
  const [iconError, setIconError] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>>>({});

  async function uploadMedia(file: File, folder: "meal-categories") {
    return apiUpload<{ url: string; key: string }>("/api/admin/media/upload", file, { folder });
  }

  async function handleImageFile(file: File) {
    setUploadingImage(true);
    setImageError("");
    try {
      const result = await uploadMedia(file, "meal-categories");
      setImage(result.url);
    } catch (err) {
      setImageError(err instanceof ApiError ? err.message : "Image upload failed");
    } finally {
      setUploadingImage(false);
    }
  }

  async function handleIconFile(file: File) {
    setUploadingIcon(true);
    setIconError("");
    try {
      const result = await uploadMedia(file, "meal-categories");
      setIcon(result.url);
    } catch (err) {
      setIconError(err instanceof ApiError ? err.message : "Icon upload failed");
    } finally {
      setUploadingIcon(false);
    }
  }

  async function handleSubmit() {
    const form = { name, slug, description, icon, sortOrder, active, image };
    const errors = validateMealCategoryForm(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setError(Object.values(errors)[0] ?? "Please fix the form errors");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const payload = mealCategoryFormToApiPayload(form);
      if (mode === "create") {
        await createMealCategory(payload);
      } else if (initial) {
        await updateMealCategory(initial.id, payload);
      }
      router.push("/admin/meal/categories?created=1");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save category");
    } finally {
      setLoading(false);
    }
  }

  return (
    <FormPage
      title={mode === "create" ? "Add Meal Category" : "Edit Meal Category"}
      subtitle="Fill in English. All 15 languages are generated automatically on save."
      backHref="/admin/meal/categories"
      backLabel="Back to Meal Categories"
      submitLabel={mode === "create" ? "Create Category" : "Save Changes"}
      loadingLabel={mode === "create" ? "Creating…" : "Saving…"}
      fullWidth
      ungrouped
      loading={loading || uploadingImage || uploadingIcon}
      error={error}
      dataResource="meal-categories"
      onSubmit={() => void handleSubmit()}
    >
      <FormSection
        variant="card"
        step={1}
        title="Basic information"
        description="English name, URL slug, and a short description."
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField
            label="Name"
            required
            htmlFor="meal-category-name"
            hint="Displayed name of the meal category."
            error={fieldErrors.name}
          >
            <TextInput
              id="meal-category-name"
              value={name}
              placeholder="Breakfast"
              onChange={(event) => {
                const next = event.target.value;
                setName(next);
                setFieldErrors((current) => ({ ...current, name: undefined }));
                if (mode === "create") {
                  const generated = slugFromName(next);
                  if (generated) setSlug(generated);
                }
              }}
            />
          </FormField>
          <FormField
            label="Slug"
            required
            htmlFor="meal-category-slug"
            hint="URL-friendly version."
            error={fieldErrors.slug}
          >
            <TextInput
              id="meal-category-slug"
              value={slug}
              placeholder="breakfast"
              onChange={(event) => {
                setSlug(event.target.value);
                setFieldErrors((current) => ({ ...current, slug: undefined }));
              }}
            />
          </FormField>
        </div>
        <FormField
          label="Description"
          htmlFor="meal-category-description"
          hint="Brief description of the meal category."
        >
          <Textarea
            id="meal-category-description"
            value={description}
            placeholder="High-protein morning meals to start the day."
            onChange={(event) => setDescription(event.target.value)}
          />
        </FormField>
      </FormSection>

      <FormSection
        variant="card"
        step={2}
        title="Category icon"
        description="Pick a preset glyph, or upload your own if none of these match."
      >
        <IconPicker
          value={icon}
          onChange={(next) => {
            setIcon(next);
            setIconError("");
          }}
          onUpload={(file) => void handleIconFile(file)}
          uploading={uploadingIcon}
        />
        {iconError ? (
          <p className="text-[12px] leading-[18px] text-[var(--bright-red)]">{iconError}</p>
        ) : null}
        {uploadingIcon ? (
          <p className="text-[12px] leading-[18px] text-[var(--text-muted)]">Uploading icon…</p>
        ) : null}
      </FormSection>

      <FormSection
        variant="card"
        step={3}
        title="Settings"
        description="List order and whether this category is visible."
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField
            label="Sort Order"
            htmlFor="meal-category-sort"
            hint="Lower numbers appear first in the list."
          >
            <NumberInput
              id="meal-category-sort"
              value={sortOrder}
              onChange={(event) => setSortOrder(event.target.value)}
            />
          </FormField>
          <FormField label="Active" hint="This category is active and visible.">
            <div className="flex h-9 items-center">
              <Toggle
                checked={active}
                onChange={setActive}
                label={active ? "Active" : "Inactive"}
              />
            </div>
          </FormField>
        </div>
      </FormSection>

      <FormSection
        variant="card"
        step={4}
        title="Image upload"
        description="Full-width cover image for this category."
      >
        <ImageUpload
          value={image}
          uploading={uploadingImage}
          error={imageError || fieldErrors.image}
          onUrlChange={(next) => {
            setImage(next);
            setFieldErrors((current) => ({ ...current, image: undefined }));
          }}
          onFileSelect={(file) => void handleImageFile(file)}
        />
      </FormSection>
    </FormPage>
  );
}
