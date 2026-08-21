"use client";

import { useEffect, useState, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import type { Difficulty, Gender, Meal } from "@/lib/types";
import {
  FormField,
  NumberInput,
  Select,
  Textarea,
  TextInput,
  Toggle,
} from "@/components/ui/fields";
import { FormSection } from "@/components/ui/feedback";
import { IconButton, SecondaryButton } from "@/components/ui/buttons";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/ui/icon";
import { MultiSelect } from "@/components/ui/multi-select";
import { FormPage } from "@/components/forms/form-page";
import { ImageUpload } from "@/components/ui/image-upload";
import { ApiError } from "@/lib/api-client";
import {
  createMeal,
  fetchMealCategories,
  mealFormToApiPayload,
  updateMeal,
  uploadMealImage,
  validateMealForm,
  type MealCategoryOption,
  type MealFormErrors,
  type MealFormState,
} from "@/lib/meals-api";

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function reorder<T extends { id: string }>(items: T[], fromId: string, toId: string) {
  if (fromId === toId) return items;
  const next = [...items];
  const from = next.findIndex((item) => item.id === fromId);
  const to = next.findIndex((item) => item.id === toId);
  if (from < 0 || to < 0) return items;
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function initialFormState(initial?: Meal): MealFormState {
  return {
    title: initial?.title ?? "",
    shortTitle: initial?.shortTitle ?? "",
    description: initial?.description ?? "",
    image: initial?.image ?? null,
    categoryIds: initial?.categoryIds ?? [],
    difficulty: initial?.difficulty ?? "easy",
    prepTimeMinutes: String(initial?.prepTimeMinutes ?? 15),
    servingSize: initial?.servingSize ?? "1 serving",
    gender: initial?.gender ?? "both",
    challenge: initial?.challenge ?? false,
    sortOrder: String(initial?.sortOrder ?? 0),
    active: initial?.active ?? true,
    nutrition: {
      calories: String(initial?.calories ?? 0),
      caloriesMax: String(initial?.caloriesMax ?? 0),
      protein: String(initial?.protein ?? 0),
      proteinMax: String(initial?.proteinMax ?? 0),
      carbs: String(initial?.carbs ?? 0),
      carbsMax: String(initial?.carbsMax ?? 0),
      fats: String(initial?.fats ?? 0),
      fatsMax: String(initial?.fatsMax ?? 0),
      fiber: String(initial?.fiber ?? 0),
      fiberMax: String(initial?.fiberMax ?? 0),
      sugar: String(initial?.sugar ?? 0),
      sugarMax: String(initial?.sugarMax ?? 0),
      sodium: String(initial?.sodium ?? 0),
      sodiumMax: String(initial?.sodiumMax ?? 0),
    },
    minWeight: String(initial?.minWeight ?? 50),
    maxWeight: String(initial?.maxWeight ?? 90),
    ingredients: initial?.ingredients?.length
      ? initial.ingredients
      : [{ id: uid(), name: "", quantity: "", unit: "g" }],
    instructions: initial?.instructions?.length
      ? initial.instructions
      : [{ id: uid(), step: 1, instruction: "" }],
  };
}

function DragHandle({
  disabled,
  onDragStart,
  onDragEnd,
}: {
  disabled?: boolean;
  onDragStart: (event: DragEvent<HTMLButtonElement>) => void;
  onDragEnd: () => void;
}) {
  return (
    <button
      type="button"
      draggable={!disabled}
      aria-label="Drag to reorder"
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-[8px] text-[var(--text-muted)]",
        disabled ? "cursor-not-allowed opacity-40" : "cursor-grab hover:bg-[var(--surface-hover)] hover:text-ink active:cursor-grabbing",
      )}
    >
      <Icon name="grip" size={16} />
    </button>
  );
}

function NutritionCard({
  label,
  min,
  max,
  onMin,
  onMax,
  accent,
}: {
  label: string;
  min: string;
  max: string;
  onMin: (value: string) => void;
  onMax: (value: string) => void;
  accent: string;
}) {
  return (
    <div
      className="rounded-[12px] border border-[var(--border)] bg-[var(--page-bg)] p-3"
      style={{ borderLeftWidth: 3, borderLeftColor: accent }}
    >
      <p className="mb-2 text-[12px] font-medium leading-[18px]">{label}</p>
      <div className="grid grid-cols-2 gap-2">
        <FormField label="Min">
          <NumberInput value={min} onChange={(event) => onMin(event.target.value)} />
        </FormField>
        <FormField label="Max">
          <NumberInput value={max} onChange={(event) => onMax(event.target.value)} />
        </FormField>
      </div>
    </div>
  );
}

export function MealForm({ mode, initial }: { mode: "create" | "edit"; initial?: Meal }) {
  const router = useRouter();
  const [form, setForm] = useState<MealFormState>(() => initialFormState(initial));
  const [categories, setCategories] = useState<MealCategoryOption[]>([]);
  const [fieldErrors, setFieldErrors] = useState<MealFormErrors>({});
  const [submitError, setSubmitError] = useState("");
  const [imageError, setImageError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [ingredientDrag, setIngredientDrag] = useState<{ id: string; over: string | null }>({
    id: "",
    over: null,
  });
  const [instructionDrag, setInstructionDrag] = useState<{ id: string; over: string | null }>({
    id: "",
    over: null,
  });

  useEffect(() => {
    void fetchMealCategories()
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  const updateForm = (patch: Partial<MealFormState>) => {
    setForm((current) => ({ ...current, ...patch }));
    setFieldErrors({});
    setSubmitError("");
  };

  const handleImageFile = async (file: File) => {
    setImageError("");
    setPendingFile(file);
    setUploadingImage(true);
    try {
      const result = await uploadMealImage(file);
      updateForm({ image: result.url });
      setPendingFile(null);
    } catch (error) {
      setImageError(error instanceof ApiError ? error.message : "Image upload failed");
      setPendingFile(null);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async () => {
    const errors = validateMealForm(form);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setSubmitting(true);
    setSubmitError("");

    try {
      let imageUrl = form.image;
      if (pendingFile) {
        setUploadingImage(true);
        const uploaded = await uploadMealImage(pendingFile);
        imageUrl = uploaded.url;
        setPendingFile(null);
        setUploadingImage(false);
      }

      const payload = mealFormToApiPayload({ ...form, image: imageUrl });
      if (mode === "create") {
        await createMeal(payload);
      } else if (initial?.id) {
        await updateMeal(initial.id, payload);
      }
      router.push("/admin/meal/meals?created=1");
    } catch (error) {
      setSubmitError(error instanceof ApiError ? error.message : "Failed to save meal");
    } finally {
      setSubmitting(false);
      setUploadingImage(false);
    }
  };

  return (
    <FormPage
      title={mode === "create" ? "Add Meal" : "Edit Meal"}
      subtitle={
        mode === "create"
          ? "Fill in English. All 15 languages are generated automatically on save."
          : `Editing meal #${initial?.id ?? ""} — English form; languages fill on save.`
      }
      backHref="/admin/meal/meals"
      backLabel="Back to Meals"
      submitLabel={mode === "create" ? "Create Meal" : "Save Changes"}
      wide
      loading={submitting}
      error={submitError}
      dataResource="meals"
      onSubmit={() => handleSubmit()}
    >
      {categories.length === 0 ? (
        <div className="mx-4 mt-4 flex items-start gap-2 rounded-[12px] border border-[rgb(255_203_102/0.35)] bg-[rgb(255_203_102/0.12)] px-4 py-3 text-[13px] md:mx-6">
          <Icon name="warning" size={16} className="mt-0.5 shrink-0 text-[var(--bright-orange)]" />
          <p>
            No meal categories found.{" "}
            <a href="/admin/data/raw-upload?resource=meal-categories" className="font-medium underline">
              Import categories
            </a>{" "}
            before creating meals.
          </p>
        </div>
      ) : null}

      <FormSection step={1} title="Basic Information" description="Title, categories, and hero image.">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(240px,300px)_1fr]">
          <FormField label="Image" error={fieldErrors.image}>
            <ImageUpload
              value={form.image}
              uploading={uploadingImage}
              error={imageError}
              onUrlChange={(url) => updateForm({ image: url })}
              onFileSelect={(file) => void handleImageFile(file)}
            />
          </FormField>
          <div className="flex flex-col gap-4">
            <FormField label="Categories" required error={fieldErrors.categoryIds}>
              <MultiSelect
                value={form.categoryIds}
                onChange={(value) => updateForm({ categoryIds: value })}
                options={categories.map((category) => ({ value: category.id, label: category.name }))}
                error={fieldErrors.categoryIds}
              />
            </FormField>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField label="Title" required error={fieldErrors.title}>
                <TextInput value={form.title} onChange={(event) => updateForm({ title: event.target.value })} />
              </FormField>
              <FormField label="Short Title">
                <TextInput
                  value={form.shortTitle}
                  onChange={(event) => updateForm({ shortTitle: event.target.value })}
                />
              </FormField>
            </div>
            <FormField label="Description">
              <Textarea
                value={form.description}
                onChange={(event) => updateForm({ description: event.target.value })}
              />
            </FormField>
          </div>
        </div>
      </FormSection>

      <FormSection step={2} title="Meal Details" description="Difficulty, timing, and visibility.">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <FormField label="Difficulty">
            <Select
              value={form.difficulty}
              onChange={(event) => updateForm({ difficulty: event.target.value as Difficulty })}
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </Select>
          </FormField>
          <FormField label="Prep Time Minutes">
            <NumberInput
              value={form.prepTimeMinutes}
              onChange={(event) => updateForm({ prepTimeMinutes: event.target.value })}
            />
          </FormField>
          <FormField label="Serving Size">
            <TextInput
              value={form.servingSize}
              onChange={(event) => updateForm({ servingSize: event.target.value })}
            />
          </FormField>
          <FormField label="Gender">
            <Select
              value={form.gender}
              onChange={(event) => updateForm({ gender: event.target.value as Gender })}
            >
              <option value="both">Both</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </Select>
          </FormField>
          <FormField label="Challenge">
            <div className="flex h-9 items-center">
              <Toggle
                checked={form.challenge}
                onChange={(value) => updateForm({ challenge: value })}
                label={form.challenge ? "Yes" : "No"}
              />
            </div>
          </FormField>
          <FormField label="Sort Order">
            <NumberInput
              value={form.sortOrder}
              onChange={(event) => updateForm({ sortOrder: event.target.value })}
            />
          </FormField>
        </div>
        <FormField label="Active">
          <Toggle
            checked={form.active}
            onChange={(value) => updateForm({ active: value })}
            label={form.active ? "Active" : "Inactive"}
          />
        </FormField>
      </FormSection>

      <FormSection step={3} title="Nutrition" description="Min and max ranges for each macro.">
        {fieldErrors.nutrition ? (
          <p className="text-[12px] leading-[18px] text-[var(--bright-red)]">{fieldErrors.nutrition}</p>
        ) : null}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <NutritionCard
            label="Calories"
            min={form.nutrition.calories}
            max={form.nutrition.caloriesMax}
            accent="var(--bright-orange)"
            onMin={(value) => updateForm({ nutrition: { ...form.nutrition, calories: value } })}
            onMax={(value) => updateForm({ nutrition: { ...form.nutrition, caloriesMax: value } })}
          />
          <NutritionCard
            label="Protein"
            min={form.nutrition.protein}
            max={form.nutrition.proteinMax}
            accent="var(--bright-purple)"
            onMin={(value) => updateForm({ nutrition: { ...form.nutrition, protein: value } })}
            onMax={(value) => updateForm({ nutrition: { ...form.nutrition, proteinMax: value } })}
          />
          <NutritionCard
            label="Carbs"
            min={form.nutrition.carbs}
            max={form.nutrition.carbsMax}
            accent="var(--bright-blue)"
            onMin={(value) => updateForm({ nutrition: { ...form.nutrition, carbs: value } })}
            onMax={(value) => updateForm({ nutrition: { ...form.nutrition, carbsMax: value } })}
          />
          <NutritionCard
            label="Fats"
            min={form.nutrition.fats}
            max={form.nutrition.fatsMax}
            accent="var(--bright-yellow)"
            onMin={(value) => updateForm({ nutrition: { ...form.nutrition, fats: value } })}
            onMax={(value) => updateForm({ nutrition: { ...form.nutrition, fatsMax: value } })}
          />
          <NutritionCard
            label="Fiber"
            min={form.nutrition.fiber}
            max={form.nutrition.fiberMax}
            accent="var(--bright-green)"
            onMin={(value) => updateForm({ nutrition: { ...form.nutrition, fiber: value } })}
            onMax={(value) => updateForm({ nutrition: { ...form.nutrition, fiberMax: value } })}
          />
          <NutritionCard
            label="Sugar"
            min={form.nutrition.sugar}
            max={form.nutrition.sugarMax}
            accent="var(--bright-mint)"
            onMin={(value) => updateForm({ nutrition: { ...form.nutrition, sugar: value } })}
            onMax={(value) => updateForm({ nutrition: { ...form.nutrition, sugarMax: value } })}
          />
          <NutritionCard
            label="Sodium"
            min={form.nutrition.sodium}
            max={form.nutrition.sodiumMax}
            accent="var(--chart-lavender)"
            onMin={(value) => updateForm({ nutrition: { ...form.nutrition, sodium: value } })}
            onMax={(value) => updateForm({ nutrition: { ...form.nutrition, sodiumMax: value } })}
          />
        </div>
      </FormSection>

      <FormSection step={4} title="Weight Range">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField label="Minimum Weight" error={fieldErrors.minWeight}>
            <NumberInput
              value={form.minWeight}
              onChange={(event) => updateForm({ minWeight: event.target.value })}
            />
          </FormField>
          <FormField label="Maximum Weight">
            <NumberInput
              value={form.maxWeight}
              onChange={(event) => updateForm({ maxWeight: event.target.value })}
            />
          </FormField>
        </div>
      </FormSection>

      <FormSection
        step={5}
        title="Ingredients"
        description="Drag rows to reorder. Empty rows are ignored on save."
      >
        <div className="relative rounded-[14px] border border-[var(--border)] bg-[var(--page-bg)] p-3">
          <div className="flex flex-col gap-2">
              {form.ingredients.map((ingredient, index) => (
                <div
                  key={ingredient.id}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setIngredientDrag((current) => ({ ...current, over: ingredient.id }));
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    if (ingredientDrag.id) {
                      updateForm({
                        ingredients: reorder(form.ingredients, ingredientDrag.id, ingredient.id),
                      });
                    }
                    setIngredientDrag({ id: "", over: null });
                  }}
                  className={cn(
                    "grid grid-cols-[32px_minmax(0,1fr)_72px_72px_32px] items-end gap-2 rounded-[10px] border border-transparent bg-[var(--surface)] px-2 py-2",
                    ingredientDrag.id === ingredient.id && "opacity-50",
                    ingredientDrag.over === ingredient.id &&
                      ingredientDrag.id &&
                      ingredientDrag.id !== ingredient.id &&
                      "bg-[var(--nav-hover-bg)]",
                  )}
                >
                  <div className={cn("flex", index === 0 ? "h-9 items-end pb-0.5" : "h-9 items-center")}>
                    <DragHandle
                      onDragStart={(event) => {
                        setIngredientDrag({ id: ingredient.id, over: null });
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("text/plain", ingredient.id);
                      }}
                      onDragEnd={() => setIngredientDrag({ id: "", over: null })}
                    />
                  </div>
                  <FormField label={index === 0 ? "Name" : ""}>
                    <TextInput
                      value={ingredient.name}
                      onChange={(event) =>
                        updateForm({
                          ingredients: form.ingredients.map((item) =>
                            item.id === ingredient.id ? { ...item, name: event.target.value } : item,
                          ),
                        })
                      }
                    />
                  </FormField>
                  <FormField label={index === 0 ? "Qty" : ""}>
                    <TextInput
                      value={ingredient.quantity}
                      onChange={(event) =>
                        updateForm({
                          ingredients: form.ingredients.map((item) =>
                            item.id === ingredient.id ? { ...item, quantity: event.target.value } : item,
                          ),
                        })
                      }
                    />
                  </FormField>
                  <FormField label={index === 0 ? "Unit" : ""}>
                    <TextInput
                      value={ingredient.unit}
                      onChange={(event) =>
                        updateForm({
                          ingredients: form.ingredients.map((item) =>
                            item.id === ingredient.id ? { ...item, unit: event.target.value } : item,
                          ),
                        })
                      }
                    />
                  </FormField>
                  <IconButton
                    type="button"
                    aria-label="Remove ingredient"
                    onClick={() =>
                      updateForm({
                        ingredients: form.ingredients.filter((item) => item.id !== ingredient.id),
                      })
                    }
                  >
                    <Icon name="minus" size={14} />
                  </IconButton>
                </div>
              ))}
              <SecondaryButton
                type="button"
                className="self-start"
                onClick={() =>
                  updateForm({
                    ingredients: [...form.ingredients, { id: uid(), name: "", quantity: "", unit: "g" }],
                  })
                }
              >
                Add Ingredient
              </SecondaryButton>
            </div>
        </div>
      </FormSection>

      <FormSection step={6} title="Instructions" description="Steps are renumbered automatically after reorder.">
        <div className="relative rounded-[14px] border border-[var(--border)] bg-[var(--page-bg)] p-3">
          <div className="flex flex-col gap-2">
              {form.instructions.map((step, index) => (
                <div
                  key={step.id}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setInstructionDrag((current) => ({ ...current, over: step.id }));
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    if (instructionDrag.id) {
                      updateForm({
                        instructions: reorder(form.instructions, instructionDrag.id, step.id).map(
                          (item, itemIndex) => ({
                            ...item,
                            step: itemIndex + 1,
                          }),
                        ),
                      });
                    }
                    setInstructionDrag({ id: "", over: null });
                  }}
                  className={cn(
                    "grid grid-cols-[32px_64px_1fr_32px] items-end gap-2 rounded-[10px] border border-transparent bg-[var(--surface)] px-2 py-2",
                    instructionDrag.id === step.id && "opacity-50",
                    instructionDrag.over === step.id &&
                      instructionDrag.id &&
                      instructionDrag.id !== step.id &&
                      "bg-[var(--nav-hover-bg)]",
                  )}
                >
                  <div className={cn("flex", index === 0 ? "h-9 items-end pb-0.5" : "h-9 items-center")}>
                    <DragHandle
                      onDragStart={(event) => {
                        setInstructionDrag({ id: step.id, over: null });
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("text/plain", step.id);
                      }}
                      onDragEnd={() => setInstructionDrag({ id: "", over: null })}
                    />
                  </div>
                  <FormField label={index === 0 ? "Step" : ""}>
                    <NumberInput value={index + 1} readOnly />
                  </FormField>
                  <FormField label={index === 0 ? "Instruction" : ""}>
                    <TextInput
                      value={step.instruction}
                      onChange={(event) =>
                        updateForm({
                          instructions: form.instructions.map((item) =>
                            item.id === step.id ? { ...item, instruction: event.target.value } : item,
                          ),
                        })
                      }
                    />
                  </FormField>
                  <IconButton
                    type="button"
                    aria-label="Remove step"
                    onClick={() =>
                      updateForm({
                        instructions: form.instructions
                          .filter((item) => item.id !== step.id)
                          .map((item, itemIndex) => ({ ...item, step: itemIndex + 1 })),
                      })
                    }
                  >
                    <Icon name="minus" size={14} />
                  </IconButton>
                </div>
              ))}
              <SecondaryButton
                type="button"
                className="self-start"
                onClick={() =>
                  updateForm({
                    instructions: [
                      ...form.instructions,
                      { id: uid(), step: form.instructions.length + 1, instruction: "" },
                    ],
                  })
                }
              >
                Add Step
              </SecondaryButton>
            </div>
        </div>
      </FormSection>
    </FormPage>
  );
}
