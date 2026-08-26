import type { ExerciseCopy, LocaleMap, MealCopy, NamedCopy } from "./i18n.js";

export type Gender = "male" | "female" | "both";

export type MealDifficulty = "Easy" | "Medium" | "Hard";

export type ExerciseDifficulty = "Beginner" | "Intermediate" | "Advanced";

export type CounterName =
  | "mealCategories"
  | "meals"
  | "workoutLevels"
  | "workoutCategories"
  | "exercises"
  | "admins"
  | "mediaAssets"
  | "dataJobs"
  | "apiKeys"
  | "workoutReminders"
  | "userDevices"
  | "notificationDeliveries";

export type ApiKeyDocument = {
  id: number;
  name: string;
  keyHash: string;
  prefix: string;
  adminId: number;
  isActive: boolean;
  createdAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
};

export type NutritionRange = {
  caloriesMin: number;
  caloriesMax: number;
  proteinMin: number;
  proteinMax: number;
  carbsMin: number;
  carbsMax: number;
  fatsMin: number;
  fatsMax: number;
  fiberMin: number;
  fiberMax: number;
  sugarMin: number;
  sugarMax: number;
  sodiumMin: number;
  sodiumMax: number;
};

export type MealIngredient = {
  name: string;
  quantity: string | null;
  unit: string | null;
  sortOrder: number;
};

export type MealInstruction = {
  step: number;
  text: string;
};

export type MealCategoryDocument = {
  id: number;
  name: string;
  slug: string;
  slugNormalized: string;
  description: string | null;
  icon: string | null;
  image: string | null;
  imageKey: string | null;
  sortOrder: number;
  isActive: boolean;
  translations?: LocaleMap<NamedCopy>;
  createdAt: Date;
  updatedAt: Date;
};

export type MealDocument = {
  id: number;
  categoryIds: number[];
  title: string;
  titleNormalized: string;
  shortTitle: string | null;
  description: string | null;
  image: string | null;
  imageKey: string | null;
  nutrition: NutritionRange;
  minWeight: number;
  maxWeight: number;
  prepTimeMinutes: number;
  difficulty: MealDifficulty;
  servingSize: string | null;
  gender: Gender;
  isChallenge: boolean;
  isActive: boolean;
  sortOrder: number;
  ingredients: MealIngredient[];
  instructions: MealInstruction[];
  translations?: LocaleMap<MealCopy>;
  createdAt: Date;
  updatedAt: Date;
};

export type WorkoutLevelDocument = {
  id: number;
  name: string;
  slug: string;
  slugNormalized: string;
  description: string | null;
  icon: string | null;
  image: string | null;
  imageKey: string | null;
  sortOrder: number;
  isActive: boolean;
  translations?: LocaleMap<NamedCopy>;
  createdAt: Date;
  updatedAt: Date;
};

export type WorkoutCategoryDocument = {
  id: number;
  levelIds: number[];
  name: string;
  slug: string;
  slugNormalized: string;
  description: string | null;
  image: string | null;
  imageKey: string | null;
  gender: Gender;
  isChallenge: boolean;
  sortOrder: number;
  isActive: boolean;
  translations?: LocaleMap<NamedCopy>;
  createdAt: Date;
  updatedAt: Date;
};

export type ExerciseTargetBodyPart = {
  name: string;
  imageUrl: string | null;
  imageKey: string | null;
  sortOrder: number;
};

export type ExerciseHowToStep = {
  step: number;
  text: string;
};

export type ExerciseTip = {
  tip: string;
  sortOrder: number;
};

export type ExerciseLevelSection = {
  levelId: number;
  customDurationMin: number;
  customDurationMax: number;
  customSetsMin: number;
  customSetsMax: number;
  customRepsMin: number;
  customRepsMax: number;
  customCaloriesMin: number;
  customCaloriesMax: number;
  notes: string | null;
  sortOrder: number;
};

export type ExerciseDocument = {
  id: number;
  categoryIds: number[];
  levelIds: number[];
  browseKeys: string[];
  title: string;
  titleNormalized: string;
  slug: string;
  slugNormalized: string;
  shortDescription: string | null;
  description: string | null;
  image: string | null;
  imageKey: string | null;
  videoUrl: string | null;
  videoKey: string | null;
  animationUrl: string | null;
  animationKey: string | null;
  difficulty: ExerciseDifficulty;
  caloriesMin: number;
  caloriesMax: number;
  repsMin: number;
  repsMax: number;
  setsMin: number;
  setsMax: number;
  durationMin: number;
  durationMax: number;
  restTimeMin: number;
  restTimeMax: number;
  minWeight: number;
  maxWeight: number;
  gender: Gender;
  isChallenge: boolean;
  sortOrder: number;
  isActive: boolean;
  targetBodyParts: ExerciseTargetBodyPart[];
  howToDo: ExerciseHowToStep[];
  tips: ExerciseTip[];
  levelSections: ExerciseLevelSection[];
  translations?: LocaleMap<ExerciseCopy>;
  createdAt: Date;
  updatedAt: Date;
};

export type AdminDocument = {
  id: number;
  name: string;
  email: string;
  emailNormalized: string;
  passwordHash: string;
  tokenVersion: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type MediaAssetDocument = {
  id: number;
  key: string;
  driver: "local" | "s3";
  mimeType: string;
  extension: string;
  bytes: number;
  sha256: string | null;
  ownerType: string;
  ownerId: number | null;
  purpose: string;
  createdByAdminId: number | null;
  createdAt: Date;
};

export type DataJobStatus = "queued" | "processing" | "completed" | "failed" | "cancelled";

export type DataJobType = "import" | "export" | "archive" | "raw";

export type DataJobDocument = {
  id: number;
  bullJobId: string | null;
  type: DataJobType;
  resource: string;
  status: DataJobStatus;
  progress: number;
  processed: number;
  successful: number;
  failed: number;
  fileKey: string | null;
  resultFileKey: string | null;
  errorSummary: string | null;
  adminId: number;
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  updatedAt: Date;
};

export type ReminderGender = "male" | "female";

export type WorkoutReminderDocument = {
  id: number;
  firebaseUid: string;
  gender: ReminderGender;
  hour: number;
  minute: number;
  days: number[];
  enabled: boolean;
  timezone: string;
  lastSentSlot: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type UserDeviceDocument = {
  id: number;
  firebaseUid: string;
  fcmToken: string;
  platform: "android" | "ios";
  lastSeenAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type NotificationDeliveryStatus = "delivered" | "partial" | "failed" | "skipped";

export type NotificationDeliveryDocument = {
  id: number;
  firebaseUid: string;
  reminderId: number;
  gender: ReminderGender;
  hour: number;
  minute: number;
  tokenCount: number;
  successCount: number;
  failureCount: number;
  status: NotificationDeliveryStatus;
  slotKey: string;
  errorMessage: string | null;
  createdAt: Date;
};

export type LegacySuccessResponse<T> = {
  success: true;
  data: T;
};

export type LegacyPaginatedResponse<T> = LegacySuccessResponse<T> & {
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
};

export type ApiErrorResponse = {
  success: false;
  error: {
    code: string;
    message: string;
  };
  requestId?: string;
};
