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
