export {
  COLLECTIONS,
  INDEX_DEFINITIONS,
  type CollectionName,
  type CounterDocument,
  type IndexDefinition,
} from "./collections.js";
export {
  closeMongo,
  connectMongo,
  createMongoClient,
  getMongo,
  pingMongo,
  resetMongoForTests,
  type MongoConnection,
} from "./client.js";
export { nextSequenceId, reserveSequenceBlock, setSequenceFloor } from "./counters.js";
export { ensureIndexes, listCollectionIndexes, type EnsureIndexesResult } from "./indexes.js";
export {
  createAdmin,
  findAdminByEmailNormalized,
  findAdminById,
  type CreateAdminInput,
} from "./repositories/admin.repository.js";
export {
  extractRawRecords,
  importRawRecords,
  type ImportRawRecordsOptions,
  type RawImportError,
  type RawImportResource,
  type RawImportResult,
} from "./raw-import.js";
export {
  createMeal,
  deleteMeal,
  findMealById,
  listMeals,
  updateMeal,
  type MealListFilters,
  type MealWriteInput,
} from "./repositories/meal.repository.js";
export {
  createMealCategory,
  deleteMealCategory,
  findMealCategoryById,
  listMealCategories,
  updateMealCategory,
  type MealCategoryListOptions,
  type MealCategoryWriteInput,
} from "./repositories/meal-category.repository.js";
export {
  createWorkoutLevel,
  deleteWorkoutLevel,
  findWorkoutLevelById,
  listWorkoutLevels,
  updateWorkoutLevel,
  type WorkoutLevelListOptions,
  type WorkoutLevelWriteInput,
} from "./repositories/workout-level.repository.js";
export {
  createWorkoutCategory,
  deleteWorkoutCategory,
  findWorkoutCategoryById,
  listWorkoutCategories,
  updateWorkoutCategory,
  type WorkoutCategoryListFilters,
  type WorkoutCategoryWriteInput,
} from "./repositories/workout-category.repository.js";
export {
  createExercise,
  deleteExercise,
  findExerciseById,
  listExercises,
  updateExercise,
  type ExerciseListFilters,
  type ExerciseWriteInput,
} from "./repositories/exercise.repository.js";
export {
  getDashboardData,
  type DashboardChartSlice,
  type DashboardData,
  type DashboardLinePoint,
  type DashboardRecentItem,
} from "./repositories/dashboard.repository.js";
export {
  createDataJob,
  findDataJobById,
  listDataJobs,
  markDataJobCompleted,
  markDataJobFailed,
  markDataJobProcessing,
  updateDataJob,
  type CreateDataJobInput,
  type UpdateDataJobProgressInput,
} from "./repositories/data-job.repository.js";
export { csvToRawRecords, filterCsvRecords, validateCsvHeaders, validateCsvRecord } from "./csv-import.js";
export { countExportRecords, exportResourceCsv, type ExportColumnDef } from "./csv-export.js";
export {
  DEFAULT_EXPORT_FILTERS,
  exportFiltersToQuery,
  matchesExportFilters,
  type ExportFilters,
  type ExportScope,
} from "./export-filters.js";
export {
  createApiKey,
  findApiKeyByHash,
  listApiKeys,
  revokeApiKey,
  touchApiKeyLastUsed,
  verifyApiKeyPlainText,
  type ApiKeyCreateResult,
  type ApiKeyListItem,
} from "./repositories/api-key.repository.js";
export {
  createWorkoutReminder,
  deleteWorkoutReminder,
  findWorkoutReminderById,
  findWorkoutReminderForUser,
  listEnabledWorkoutReminders,
  listWorkoutRemindersByUser,
  markWorkoutReminderSent,
  setWorkoutReminderEnabled,
  updateWorkoutReminder,
  type WorkoutReminderWriteInput,
} from "./repositories/workout-reminder.repository.js";
export {
  deleteUserDeviceByToken,
  listUserDeviceTokens,
  upsertUserDevice,
  type RegisterDeviceInput,
} from "./repositories/user-device.repository.js";
export {
  deleteAdminWorkoutReminder,
  getAdminWorkoutReminderSummary,
  listAdminWorkoutReminderItems,
  listAdminWorkoutReminders,
  toggleAdminWorkoutReminder,
  adminWorkoutReminderCacheKey,
  adminWorkoutReminderSummaryCacheKey,
  WORKOUT_REMINDER_SUMMARY_SNAPSHOT,
  type AdminWorkoutReminderAnalytics,
  type AdminWorkoutReminderFilters,
  type AdminWorkoutReminderListResult,
  type AdminWorkoutReminderRow,
  type AdminWorkoutReminderStats,
  type AdminWorkoutReminderSummary,
} from "./repositories/admin-workout-reminders.repository.js";
export {
  deleteAdminUserDevice,
  getAdminDeviceSummary,
  listAdminUserDeviceItems,
  listAdminUserDevices,
  adminDeviceCacheKey,
  adminDeviceSummaryCacheKey,
  USER_DEVICES_SUMMARY_SNAPSHOT,
  type AdminDeviceAnalytics,
  type AdminDeviceFilters,
  type AdminDeviceListResult,
  type AdminDeviceRow,
  type AdminDeviceStats,
  type AdminDeviceSummary,
  type DeviceStatus,
} from "./repositories/admin-user-devices.repository.js";
export {
  getAdminFcmOverview,
  adminFcmOverviewCacheKey,
  type FcmActivityItem,
  type FcmDeliveryChartPoint,
  type FcmOverviewResult,
  type FcmOverviewStats,
  type FcmRecentDeliveryRow,
  type FcmSystemStatus,
} from "./repositories/admin-fcm-overview.repository.js";
export {
  findNotificationDeliveryById,
  recordNotificationDelivery,
  type RecordNotificationDeliveryInput,
} from "./repositories/notification-delivery.repository.js";
export {
  adminDeliveryLogCacheKey,
  adminDeliveryLogSummaryCacheKey,
  getAdminDeliveryLogSummary,
  listAdminDeliveryLogs,
  type AdminDeliveryLogAnalytics,
  type AdminDeliveryLogFilters,
  type AdminDeliveryLogListResult,
  type AdminDeliveryLogRow,
  type AdminDeliveryLogStats,
  type AdminDeliveryLogSummary,
  type DeliveryLogStatusFilter,
} from "./repositories/admin-delivery-logs.repository.js";
