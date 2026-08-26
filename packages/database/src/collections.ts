import type { CounterName } from "@weightloss/contracts";

export const COLLECTIONS = {
  counters: "counters",
  admins: "admins",
  mealCategories: "mealCategories",
  meals: "meals",
  workoutLevels: "workoutLevels",
  workoutCategories: "workoutCategories",
  exercises: "exercises",
  mediaAssets: "mediaAssets",
  dataJobs: "dataJobs",
  adminAuditLogs: "adminAuditLogs",
  apiKeys: "apiKeys",
  workoutReminders: "workoutReminders",
  userDevices: "userDevices",
  notificationDeliveries: "notificationDeliveries",
} as const;

export type CollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];

export type CounterDocument = {
  _id: CounterName;
  seq: number;
};

export type IndexDefinition = {
  collection: CollectionName;
  name: string;
  keys: Record<string, 1 | -1>;
  unique?: boolean;
  partialFilterExpression?: Record<string, unknown>;
};

export const INDEX_DEFINITIONS: IndexDefinition[] = [
  // admins
  { collection: COLLECTIONS.admins, name: "admins_id_unique", keys: { id: 1 }, unique: true },
  {
    collection: COLLECTIONS.admins,
    name: "admins_emailNormalized_unique",
    keys: { emailNormalized: 1 },
    unique: true,
  },
  { collection: COLLECTIONS.admins, name: "admins_isActive", keys: { isActive: 1 } },

  // meal categories
  {
    collection: COLLECTIONS.mealCategories,
    name: "mealCategories_id_unique",
    keys: { id: 1 },
    unique: true,
  },
  {
    collection: COLLECTIONS.mealCategories,
    name: "mealCategories_slugNormalized_unique",
    keys: { slugNormalized: 1 },
    unique: true,
  },
  {
    collection: COLLECTIONS.mealCategories,
    name: "mealCategories_active_sort",
    keys: { isActive: 1, sortOrder: 1, id: 1 },
  },
  {
    collection: COLLECTIONS.mealCategories,
    name: "mealCategories_active_partial_sort",
    keys: { sortOrder: 1, id: 1 },
    partialFilterExpression: { isActive: true },
  },

  // meals
  { collection: COLLECTIONS.meals, name: "meals_id_unique", keys: { id: 1 }, unique: true },
  {
    collection: COLLECTIONS.meals,
    name: "meals_category_filters_sort",
    keys: {
      categoryIds: 1,
      isActive: 1,
      gender: 1,
      isChallenge: 1,
      sortOrder: 1,
      id: 1,
    },
  },
  {
    collection: COLLECTIONS.meals,
    name: "meals_public_filters_sort",
    keys: { isActive: 1, gender: 1, isChallenge: 1, sortOrder: 1, id: 1 },
  },
  {
    collection: COLLECTIONS.meals,
    name: "meals_challenge_active_sort",
    keys: { isChallenge: 1, isActive: 1, sortOrder: 1 },
  },
  {
    collection: COLLECTIONS.meals,
    name: "meals_titleNormalized",
    keys: { titleNormalized: 1, id: 1 },
  },
  {
    collection: COLLECTIONS.meals,
    name: "meals_weight_with_category",
    keys: {
      categoryIds: 1,
      isActive: 1,
      gender: 1,
      isChallenge: 1,
      minWeight: 1,
      maxWeight: 1,
      sortOrder: 1,
    },
  },
  {
    collection: COLLECTIONS.meals,
    name: "meals_weight_public",
    keys: {
      isActive: 1,
      gender: 1,
      isChallenge: 1,
      minWeight: 1,
      maxWeight: 1,
      sortOrder: 1,
    },
  },

  // workout levels
  {
    collection: COLLECTIONS.workoutLevels,
    name: "workoutLevels_id_unique",
    keys: { id: 1 },
    unique: true,
  },
  {
    collection: COLLECTIONS.workoutLevels,
    name: "workoutLevels_slugNormalized_unique",
    keys: { slugNormalized: 1 },
    unique: true,
  },
  {
    collection: COLLECTIONS.workoutLevels,
    name: "workoutLevels_active_sort",
    keys: { isActive: 1, sortOrder: 1, id: 1 },
  },

  // workout categories
  {
    collection: COLLECTIONS.workoutCategories,
    name: "workoutCategories_id_unique",
    keys: { id: 1 },
    unique: true,
  },
  {
    collection: COLLECTIONS.workoutCategories,
    name: "workoutCategories_slugNormalized_unique",
    keys: { slugNormalized: 1 },
    unique: true,
  },
  {
    collection: COLLECTIONS.workoutCategories,
    name: "workoutCategories_level_filters_sort",
    keys: {
      levelIds: 1,
      isActive: 1,
      gender: 1,
      isChallenge: 1,
      sortOrder: 1,
      id: 1,
    },
  },
  {
    collection: COLLECTIONS.workoutCategories,
    name: "workoutCategories_public_filters_sort",
    keys: { isActive: 1, gender: 1, isChallenge: 1, sortOrder: 1 },
  },

  // exercises
  { collection: COLLECTIONS.exercises, name: "exercises_id_unique", keys: { id: 1 }, unique: true },
  {
    collection: COLLECTIONS.exercises,
    name: "exercises_slugNormalized_unique",
    keys: { slugNormalized: 1 },
    unique: true,
  },
  {
    collection: COLLECTIONS.exercises,
    name: "exercises_browse_filters_sort",
    keys: {
      browseKeys: 1,
      isActive: 1,
      gender: 1,
      isChallenge: 1,
      sortOrder: 1,
      id: 1,
    },
  },
  {
    collection: COLLECTIONS.exercises,
    name: "exercises_level_filters_sort",
    keys: {
      levelIds: 1,
      isActive: 1,
      gender: 1,
      isChallenge: 1,
      sortOrder: 1,
      id: 1,
    },
  },
  {
    collection: COLLECTIONS.exercises,
    name: "exercises_category_filters_sort",
    keys: {
      categoryIds: 1,
      isActive: 1,
      gender: 1,
      isChallenge: 1,
      sortOrder: 1,
      id: 1,
    },
  },
  {
    collection: COLLECTIONS.exercises,
    name: "exercises_public_filters_sort",
    keys: { isActive: 1, gender: 1, isChallenge: 1, sortOrder: 1, id: 1 },
  },
  {
    collection: COLLECTIONS.exercises,
    name: "exercises_challenge_active_sort",
    keys: { isChallenge: 1, isActive: 1, sortOrder: 1 },
  },
  {
    collection: COLLECTIONS.exercises,
    name: "exercises_titleNormalized",
    keys: { titleNormalized: 1, id: 1 },
  },

  // media + jobs
  {
    collection: COLLECTIONS.mediaAssets,
    name: "mediaAssets_id_unique",
    keys: { id: 1 },
    unique: true,
  },
  { collection: COLLECTIONS.dataJobs, name: "dataJobs_id_unique", keys: { id: 1 }, unique: true },
  {
    collection: COLLECTIONS.dataJobs,
    name: "dataJobs_status_created",
    keys: { status: 1, createdAt: -1 },
  },

  // api keys
  { collection: COLLECTIONS.apiKeys, name: "apiKeys_id_unique", keys: { id: 1 }, unique: true },
  {
    collection: COLLECTIONS.apiKeys,
    name: "apiKeys_keyHash_unique",
    keys: { keyHash: 1 },
    unique: true,
  },
  { collection: COLLECTIONS.apiKeys, name: "apiKeys_admin_active", keys: { adminId: 1, isActive: 1 } },

  // workout reminders
  {
    collection: COLLECTIONS.workoutReminders,
    name: "workoutReminders_id_unique",
    keys: { id: 1 },
    unique: true,
  },
  {
    collection: COLLECTIONS.workoutReminders,
    name: "workoutReminders_uid_gender",
    keys: { firebaseUid: 1, gender: 1, id: 1 },
  },
  {
    collection: COLLECTIONS.workoutReminders,
    name: "workoutReminders_enabled",
    keys: { enabled: 1, id: 1 },
  },
  {
    collection: COLLECTIONS.workoutReminders,
    name: "workoutReminders_admin_filters",
    keys: { gender: 1, enabled: 1, timezone: 1, id: -1 },
  },
  {
    collection: COLLECTIONS.workoutReminders,
    name: "workoutReminders_timezone_sort",
    keys: { timezone: 1, id: -1 },
  },

  // user devices
  {
    collection: COLLECTIONS.userDevices,
    name: "userDevices_id_unique",
    keys: { id: 1 },
    unique: true,
  },
  {
    collection: COLLECTIONS.userDevices,
    name: "userDevices_uid_token_unique",
    keys: { firebaseUid: 1, fcmToken: 1 },
    unique: true,
  },
  {
    collection: COLLECTIONS.userDevices,
    name: "userDevices_uid_lastSeen",
    keys: { firebaseUid: 1, lastSeenAt: -1 },
  },
  {
    collection: COLLECTIONS.userDevices,
    name: "userDevices_admin_list",
    keys: { lastSeenAt: -1, id: -1 },
  },
  {
    collection: COLLECTIONS.userDevices,
    name: "userDevices_platform_lastSeen",
    keys: { platform: 1, lastSeenAt: -1, id: -1 },
  },
  {
    collection: COLLECTIONS.userDevices,
    name: "userDevices_createdAt",
    keys: { createdAt: -1 },
  },

  // notification delivery logs
  {
    collection: COLLECTIONS.notificationDeliveries,
    name: "notificationDeliveries_id_unique",
    keys: { id: 1 },
    unique: true,
  },
  {
    collection: COLLECTIONS.notificationDeliveries,
    name: "notificationDeliveries_createdAt",
    keys: { createdAt: -1 },
  },
  {
    collection: COLLECTIONS.notificationDeliveries,
    name: "notificationDeliveries_status_createdAt",
    keys: { status: 1, createdAt: -1 },
  },
  {
    collection: COLLECTIONS.notificationDeliveries,
    name: "notificationDeliveries_uid_createdAt",
    keys: { firebaseUid: 1, createdAt: -1 },
  },
];
