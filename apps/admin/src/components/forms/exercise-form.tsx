"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  Difficulty,
  Exercise,
  ExerciseTip,
  Gender,
  InstructionStep,
  LevelSection,
  TargetBodyPart,
  WorkoutCategory,
  WorkoutLevel,
} from "@/lib/types";
import { FormField, NumberInput, Select, Textarea, TextInput, Toggle } from "@/components/ui/fields";
import { FormSection } from "@/components/ui/feedback";
import { IconButton, SecondaryButton } from "@/components/ui/buttons";
import { Icon } from "@/components/ui/icon";
import { MultiSelect } from "@/components/ui/multi-select";
import { ImageUpload } from "@/components/ui/image-upload";
import { FormPage, slugFromName } from "@/components/forms/form-page";
import { ApiError, apiUpload } from "@/lib/api-client";
import { fetchWorkoutCategoriesAdmin } from "@/lib/workout-categories-api";
import { fetchWorkoutLevelsAdmin } from "@/lib/workout-levels-api";
import {
  createDefaultLevelSection,
  createExercise,
  exerciseFormToApiPayload,
  updateExercise,
  validateExerciseForm,
} from "@/lib/exercises-api";

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function RangePair({
  label,
  min,
  max,
  onMin,
  onMax,
}: {
  label: string;
  min: string;
  max: string;
  onMin: (value: string) => void;
  onMax: (value: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <FormField label={`${label} min`}>
        <NumberInput value={min} onChange={(event) => onMin(event.target.value)} />
      </FormField>
      <FormField label={`${label} max`}>
        <NumberInput value={max} onChange={(event) => onMax(event.target.value)} />
      </FormField>
    </div>
  );
}

export function ExerciseForm({ mode, initial }: { mode: "create" | "edit"; initial?: Exercise }) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [shortDescription, setShortDescription] = useState(initial?.shortDescription ?? "");
  const [fullDescription, setFullDescription] = useState(initial?.fullDescription ?? "");
  const [levelIds, setLevelIds] = useState<string[]>(initial?.levelIds ?? []);
  const [categoryIds, setCategoryIds] = useState<string[]>(initial?.categoryIds ?? []);
  const [difficulty, setDifficulty] = useState<Difficulty>(initial?.difficulty ?? "easy");
  const [gender, setGender] = useState<Gender>(initial?.gender ?? "both");
  const [challenge, setChallenge] = useState(initial?.challenge ?? false);
  const [sortOrder, setSortOrder] = useState(String(initial?.sortOrder ?? 0));
  const [active, setActive] = useState(initial?.active ?? true);
  const [image, setImage] = useState<string | null>(initial?.image ?? null);
  const [animation, setAnimation] = useState<string | null>(initial?.animation ?? null);
  const [videoUrl, setVideoUrl] = useState(initial?.videoUrl ?? "");
  const [metrics, setMetrics] = useState({
    durationMin: String(initial?.durationMin ?? 0),
    durationMax: String(initial?.durationMax ?? 0),
    caloriesMin: String(initial?.caloriesMin ?? 0),
    caloriesMax: String(initial?.caloriesMax ?? 0),
    setsMin: String(initial?.setsMin ?? 0),
    setsMax: String(initial?.setsMax ?? 0),
    repsMin: String(initial?.repsMin ?? 0),
    repsMax: String(initial?.repsMax ?? 0),
    restMin: String(initial?.restMin ?? 0),
    restMax: String(initial?.restMax ?? 0),
    weightMin: String(initial?.weightMin ?? 0),
    weightMax: String(initial?.weightMax ?? 0),
  });
  const [levelSections, setLevelSections] = useState<LevelSection[]>(initial?.levelSections ?? []);
  const [bodyParts, setBodyParts] = useState<TargetBodyPart[]>(
    initial?.targetBodyParts ?? [{ id: uid(), name: "", image: null }],
  );
  const [howTo, setHowTo] = useState<InstructionStep[]>(
    initial?.howTo ?? [{ id: uid(), step: 1, instruction: "" }],
  );
  const [tips, setTips] = useState<ExerciseTip[]>(initial?.tips ?? [{ id: uid(), tip: "" }]);

  const [workoutLevels, setWorkoutLevels] = useState<WorkoutLevel[]>([]);
  const [workoutCategories, setWorkoutCategories] = useState<WorkoutCategory[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingAnimation, setUploadingAnimation] = useState(false);
  const [imageError, setImageError] = useState("");
  const [animationError, setAnimationError] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const [levels, categories] = await Promise.all([
          fetchWorkoutLevelsAdmin(),
          fetchWorkoutCategoriesAdmin(),
        ]);
        setWorkoutLevels(levels);
        setWorkoutCategories(categories);
      } finally {
        setLoadingOptions(false);
      }
    })();
  }, []);

  const selectedLevels = useMemo(
    () => workoutLevels.filter((level) => levelIds.includes(level.id)),
    [levelIds, workoutLevels],
  );

  const syncLevelSections = (nextIds: string[]) => {
    setLevelIds(nextIds);
    setLevelSections((current) => {
      const kept = current.filter((section) => nextIds.includes(section.levelId));
      const missing = nextIds.filter((id) => !kept.some((section) => section.levelId === id));
      return [
        ...kept,
        ...missing.map((levelId) => {
          const level = workoutLevels.find((item) => item.id === levelId);
          return createDefaultLevelSection(levelId, level?.name);
        }),
      ];
    });
  };

  async function uploadMedia(file: File, folder: string) {
    return apiUpload<{ url: string }>("/api/admin/media/upload", file, { folder });
  }

  async function handleSubmit() {
    const form = {
      title,
      slug,
      shortDescription,
      fullDescription,
      levelIds,
      categoryIds,
      difficulty,
      gender,
      challenge,
      sortOrder,
      active,
      image,
      animation,
      videoUrl,
      durationMin: metrics.durationMin,
      durationMax: metrics.durationMax,
      caloriesMin: metrics.caloriesMin,
      caloriesMax: metrics.caloriesMax,
      setsMin: metrics.setsMin,
      setsMax: metrics.setsMax,
      repsMin: metrics.repsMin,
      repsMax: metrics.repsMax,
      restMin: metrics.restMin,
      restMax: metrics.restMax,
      weightMin: metrics.weightMin,
      weightMax: metrics.weightMax,
      levelSections,
      bodyParts,
      howTo,
      tips,
    };

    const errors = validateExerciseForm(form);
    if (Object.keys(errors).length > 0) {
      setError(Object.values(errors)[0] ?? "Please fix the form errors");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const payload = exerciseFormToApiPayload(form);
      if (mode === "create") await createExercise(payload);
      else if (initial) await updateExercise(initial.id, payload);
      router.push("/admin/workout/exercises?created=1");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save exercise");
    } finally {
      setLoading(false);
    }
  }

  return (
    <FormPage
      title={mode === "create" ? "Add Exercise" : "Edit Exercise"}
      subtitle="Fill in English. All 15 languages are generated automatically on save."
      backHref="/admin/workout/exercises"
      backLabel="Back to Exercises"
      submitLabel={mode === "create" ? "Create Exercise" : "Save Changes"}
      wide
      loading={loading}
      error={error}
      dataResource="exercises"
      onSubmit={() => void handleSubmit()}
    >
      <FormSection title="Basic Information">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField label="Workout Levels" required>
            <MultiSelect
              value={levelIds}
              onChange={syncLevelSections}
              options={workoutLevels.map((level) => ({ value: level.id, label: level.name }))}
              placeholder={loadingOptions ? "Loading levels..." : "Select levels"}
            />
          </FormField>
          <FormField label="Workout Categories" required>
            <MultiSelect
              value={categoryIds}
              onChange={setCategoryIds}
              options={workoutCategories.map((category) => ({ value: category.id, label: category.name }))}
              placeholder={loadingOptions ? "Loading categories..." : "Select categories"}
            />
          </FormField>
          <FormField label="Title" required>
            <TextInput
              value={title}
              placeholder="Bodyweight Squat"
              onChange={(event) => {
                const next = event.target.value;
                setTitle(next);
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
              onChange={(event) => setSlug(event.target.value)}
            />
          </FormField>
        </div>
        <FormField label="Short Description">
          <TextInput value={shortDescription} onChange={(event) => setShortDescription(event.target.value)} />
        </FormField>
        <FormField label="Full Description">
          <Textarea value={fullDescription} onChange={(event) => setFullDescription(event.target.value)} />
        </FormField>
      </FormSection>

      <FormSection title="Exercise Metrics">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <RangePair
            label="Duration"
            min={metrics.durationMin}
            max={metrics.durationMax}
            onMin={(value) => setMetrics((current) => ({ ...current, durationMin: value }))}
            onMax={(value) => setMetrics((current) => ({ ...current, durationMax: value }))}
          />
          <RangePair
            label="Calories"
            min={metrics.caloriesMin}
            max={metrics.caloriesMax}
            onMin={(value) => setMetrics((current) => ({ ...current, caloriesMin: value }))}
            onMax={(value) => setMetrics((current) => ({ ...current, caloriesMax: value }))}
          />
          <RangePair
            label="Sets"
            min={metrics.setsMin}
            max={metrics.setsMax}
            onMin={(value) => setMetrics((current) => ({ ...current, setsMin: value }))}
            onMax={(value) => setMetrics((current) => ({ ...current, setsMax: value }))}
          />
          <RangePair
            label="Reps"
            min={metrics.repsMin}
            max={metrics.repsMax}
            onMin={(value) => setMetrics((current) => ({ ...current, repsMin: value }))}
            onMax={(value) => setMetrics((current) => ({ ...current, repsMax: value }))}
          />
          <RangePair
            label="Rest"
            min={metrics.restMin}
            max={metrics.restMax}
            onMin={(value) => setMetrics((current) => ({ ...current, restMin: value }))}
            onMax={(value) => setMetrics((current) => ({ ...current, restMax: value }))}
          />
          <RangePair
            label="Weight"
            min={metrics.weightMin}
            max={metrics.weightMax}
            onMin={(value) => setMetrics((current) => ({ ...current, weightMin: value }))}
            onMax={(value) => setMetrics((current) => ({ ...current, weightMax: value }))}
          />
        </div>
      </FormSection>

      <FormSection title="Configuration">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <FormField label="Difficulty">
            <Select value={difficulty} onChange={(event) => setDifficulty(event.target.value as Difficulty)}>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </Select>
          </FormField>
          <FormField label="Gender">
            <Select value={gender} onChange={(event) => setGender(event.target.value as Gender)}>
              <option value="both">Both</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </Select>
          </FormField>
          <FormField label="Sort Order">
            <NumberInput value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} />
          </FormField>
        </div>
        <div className="flex flex-wrap gap-6">
          <Toggle checked={challenge} onChange={setChallenge} label={challenge ? "Challenge" : "Standard"} />
          <Toggle checked={active} onChange={setActive} label={active ? "Active" : "Inactive"} />
        </div>
      </FormSection>

      <FormSection title="Media">
        <FormField label="Image">
          <ImageUpload
            value={image}
            uploading={uploadingImage}
            error={imageError}
            onUrlChange={setImage}
            onFileSelect={(file) => {
              void (async () => {
                setUploadingImage(true);
                setImageError("");
                try {
                  const result = await uploadMedia(file, "exercises");
                  setImage(result.url);
                } catch (err) {
                  setImageError(err instanceof ApiError ? err.message : "Image upload failed");
                } finally {
                  setUploadingImage(false);
                }
              })();
            }}
          />
        </FormField>
        <FormField label="Animation">
          <ImageUpload
            value={animation}
            uploading={uploadingAnimation}
            error={animationError}
            onUrlChange={setAnimation}
            onFileSelect={(file) => {
              void (async () => {
                setUploadingAnimation(true);
                setAnimationError("");
                try {
                  const result = await uploadMedia(file, "exercises");
                  setAnimation(result.url);
                } catch (err) {
                  setAnimationError(err instanceof ApiError ? err.message : "Animation upload failed");
                } finally {
                  setUploadingAnimation(false);
                }
              })();
            }}
          />
        </FormField>
        <FormField label="Video URL">
          <TextInput value={videoUrl} onChange={(event) => setVideoUrl(event.target.value)} placeholder="https://" />
        </FormField>
      </FormSection>

      <FormSection title="Level Sections" description="One section per selected workout level.">
        {selectedLevels.length === 0 ? (
          <p className="typo-helper">Select workout levels above to configure per-level guidance.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {levelSections.map((section) => {
              const level = workoutLevels.find((item) => item.id === section.levelId);
              return (
                <div
                  key={section.id}
                  className="rounded-[12px] border border-[var(--border)] bg-[var(--surface-muted)] p-4"
                >
                  <p className="mb-3 text-[14px] font-semibold leading-5">{level?.name ?? "Level"}</p>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <FormField label="Title">
                      <TextInput
                        value={section.title}
                        onChange={(event) =>
                          setLevelSections((current) =>
                            current.map((item) =>
                              item.id === section.id ? { ...item, title: event.target.value } : item,
                            ),
                          )
                        }
                      />
                    </FormField>
                    <FormField label="Sets">
                      <TextInput
                        value={section.sets}
                        onChange={(event) =>
                          setLevelSections((current) =>
                            current.map((item) =>
                              item.id === section.id ? { ...item, sets: event.target.value } : item,
                            ),
                          )
                        }
                      />
                    </FormField>
                    <FormField label="Reps">
                      <TextInput
                        value={section.reps}
                        onChange={(event) =>
                          setLevelSections((current) =>
                            current.map((item) =>
                              item.id === section.id ? { ...item, reps: event.target.value } : item,
                            ),
                          )
                        }
                      />
                    </FormField>
                    <FormField label="Rest (seconds)">
                      <TextInput
                        value={section.restSeconds}
                        onChange={(event) =>
                          setLevelSections((current) =>
                            current.map((item) =>
                              item.id === section.id ? { ...item, restSeconds: event.target.value } : item,
                            ),
                          )
                        }
                      />
                    </FormField>
                  </div>
                  <FormField label="Notes" className="mt-3">
                    <Textarea
                      value={section.notes}
                      onChange={(event) =>
                        setLevelSections((current) =>
                          current.map((item) =>
                            item.id === section.id ? { ...item, notes: event.target.value } : item,
                          ),
                        )
                      }
                    />
                  </FormField>
                </div>
              );
            })}
          </div>
        )}
      </FormSection>

      <FormSection title="Target Body Parts">
        <div className="flex flex-col gap-2">
          {bodyParts.map((part, index) => (
            <div key={part.id} className="grid grid-cols-1 items-end gap-2 md:grid-cols-[1fr_1fr_32px]">
              <FormField label={index === 0 ? "Body Part Name" : ""}>
                <TextInput
                  value={part.name}
                  onChange={(event) =>
                    setBodyParts((current) =>
                      current.map((item) =>
                        item.id === part.id ? { ...item, name: event.target.value } : item,
                      ),
                    )
                  }
                />
              </FormField>
              <FormField label={index === 0 ? "Image URL" : ""}>
                <TextInput
                  value={part.image ?? ""}
                  placeholder="https://"
                  onChange={(event) =>
                    setBodyParts((current) =>
                      current.map((item) =>
                        item.id === part.id ? { ...item, image: event.target.value || null } : item,
                      ),
                    )
                  }
                />
              </FormField>
              <IconButton
                type="button"
                aria-label="Remove body part"
                onClick={() => setBodyParts((current) => current.filter((item) => item.id !== part.id))}
              >
                <Icon name="minus" size={14} />
              </IconButton>
            </div>
          ))}
          <SecondaryButton
            type="button"
            className="self-start"
            onClick={() => setBodyParts((current) => [...current, { id: uid(), name: "", image: null }])}
          >
            Add Body Part
          </SecondaryButton>
        </div>
      </FormSection>

      <FormSection title="How To Do">
        <div className="flex flex-col gap-2">
          {howTo.map((step, index) => (
            <div key={step.id} className="grid grid-cols-[64px_1fr_32px] items-end gap-2">
              <FormField label={index === 0 ? "Step" : ""}>
                <NumberInput value={step.step} readOnly />
              </FormField>
              <FormField label={index === 0 ? "Instruction" : ""}>
                <TextInput
                  value={step.instruction}
                  onChange={(event) =>
                    setHowTo((current) =>
                      current.map((item) =>
                        item.id === step.id ? { ...item, instruction: event.target.value } : item,
                      ),
                    )
                  }
                />
              </FormField>
              <IconButton
                type="button"
                aria-label="Remove step"
                onClick={() =>
                  setHowTo((current) =>
                    current
                      .filter((item) => item.id !== step.id)
                      .map((item, itemIndex) => ({ ...item, step: itemIndex + 1 })),
                  )
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
              setHowTo((current) => [...current, { id: uid(), step: current.length + 1, instruction: "" }])
            }
          >
            Add Step
          </SecondaryButton>
        </div>
      </FormSection>

      <FormSection title="Tips">
        <div className="flex flex-col gap-2">
          {tips.map((tip, index) => (
            <div key={tip.id} className="grid grid-cols-[1fr_32px] items-end gap-2">
              <FormField label={index === 0 ? "Tip" : ""}>
                <TextInput
                  value={tip.tip}
                  onChange={(event) =>
                    setTips((current) =>
                      current.map((item) => (item.id === tip.id ? { ...item, tip: event.target.value } : item)),
                    )
                  }
                />
              </FormField>
              <IconButton
                type="button"
                aria-label="Remove tip"
                onClick={() => setTips((current) => current.filter((item) => item.id !== tip.id))}
              >
                <Icon name="minus" size={14} />
              </IconButton>
            </div>
          ))}
          <SecondaryButton
            type="button"
            className="self-start"
            onClick={() => setTips((current) => [...current, { id: uid(), tip: "" }])}
          >
            Add Tip
          </SecondaryButton>
        </div>
      </FormSection>
    </FormPage>
  );
}
