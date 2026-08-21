export type ApiSuccess<T> = {
  success: true;
  data: T;
};

export type ApiFailure = {
  success: false;
  error: {
    code: string;
    message: string;
  };
  requestId?: string;
};

export type Paginated<T> = ApiSuccess<T> & {
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
};

export type Gender = "male" | "female" | "both";

export type NutritionRange = {
  calories_min: number;
  calories_max: number;
  protein_min: number;
  protein_max: number;
  carbs_min: number;
  carbs_max: number;
  fats_min: number;
  fats_max: number;
  fiber_min: number;
  fiber_max: number;
  sugar_min: number;
  sugar_max: number;
  sodium_min: number;
  sodium_max: number;
};

export type MealCategory = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  image: string | null;
  sort_order: number;
  is_active: boolean;
};

export type MealListItem = {
  id: number;
  category_ids: number[];
  title: string;
  short_title: string | null;
  description: string | null;
  image: string | null;
  nutrition: NutritionRange;
  min_weight: number | null;
  max_weight: number | null;
  prep_time_minutes: number | null;
  difficulty: string | null;
  serving_size: string | null;
  gender: Gender;
  is_challenge: boolean;
  sort_order: number;
  is_active: boolean;
};

export type MealDetail = MealListItem & {
  ingredients: Array<{
    name: string;
    quantity: string | null;
    unit: string | null;
    sort_order: number;
  }>;
  instructions: Array<{
    step: number;
    text: string;
  }>;
};

export type WorkoutLevel = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  image: string | null;
  sort_order: number;
  is_active: boolean;
};

export type WorkoutCategory = {
  id: number;
  level_ids: number[];
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  image: string | null;
  gender: Gender;
  is_challenge: boolean;
  sort_order: number;
  is_active: boolean;
};

export type ExerciseListItem = {
  id: number;
  category_ids: number[];
  level_ids: number[];
  title: string;
  description: string | null;
  image: string | null;
  video_url: string | null;
  min_weight: number | null;
  max_weight: number | null;
  duration_seconds: number | null;
  difficulty: string | null;
  gender: Gender;
  is_challenge: boolean;
  browse_keys: string[];
  sort_order: number;
  is_active: boolean;
};

export type ExerciseDetail = ExerciseListItem & {
  instructions: Array<{
    step: number;
    text: string;
  }>;
};

export type MealListParams = {
  page?: number;
  limit?: number;
  category_id?: number;
  gender?: Gender;
  is_challenge?: boolean;
  weight?: number;
  search?: string;
  lang: string;
};

export type WorkoutCategoryListParams = {
  page?: number;
  limit?: number;
  level_id?: number;
  gender?: Gender;
  is_challenge?: boolean;
  lang: string;
};

export type ExerciseListParams = {
  page?: number;
  limit?: number;
  category_id?: number;
  level_id?: number;
  browse_key?: string;
  gender?: Gender;
  is_challenge?: boolean;
  weight?: number;
  search?: string;
  lang: string;
};

export type ApiMeta = {
  version: string;
  format: string;
  pagination: Record<string, string>;
  endpoints: Array<{ method: string; path: string; description: string }>;
  sdk: string;
  docs: string;
  openapi: string;
};
