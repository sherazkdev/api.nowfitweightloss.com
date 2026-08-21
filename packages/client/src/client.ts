import { HttpClient, toQuery } from "./http.js";
import type {
  ApiMeta,
  ExerciseDetail,
  ExerciseListItem,
  ExerciseListParams,
  MealCategory,
  MealDetail,
  MealListItem,
  MealListParams,
  Paginated,
  WorkoutCategory,
  WorkoutCategoryListParams,
  WorkoutLevel,
} from "./types.js";

export type WeightLossClientOptions = {
  /** API origin, e.g. https://api.example.com */
  baseUrl: string;
  /** Use `/api/v1` (default) or legacy unversioned `/api` */
  apiVersion?: "v1" | "legacy";
  fetchImpl?: typeof fetch;
  userAgent?: string;
};

export class WeightLossClient {
  private readonly http: HttpClient;

  constructor(options: WeightLossClientOptions) {
    const origin = options.baseUrl.replace(/\/$/, "");
    const prefix = options.apiVersion === "legacy" ? "/api" : "/api/v1";
    this.http = new HttpClient({
      baseUrl: `${origin}${prefix}`,
      fetchImpl: options.fetchImpl,
      userAgent: options.userAgent,
    });
  }

  getMeta() {
    return this.http.getData<ApiMeta>("/");
  }

  getMealCategories(params: { lang: string }, ifNoneMatch?: string) {
    return this.http.getData<MealCategory[]>("/meal-categories", {
      query: toQuery({ lang: params.lang }),
      ifNoneMatch,
    });
  }

  getMeals(params: MealListParams, ifNoneMatch?: string) {
    return this.http.getPaginated<MealListItem[]>("/meals", {
      query: toQuery({
        page: params.page,
        limit: params.limit,
        category_id: params.category_id,
        gender: params.gender,
        is_challenge: params.is_challenge,
        weight: params.weight,
        search: params.search,
        lang: params.lang,
      }),
      ifNoneMatch,
    });
  }

  getMealsConditional(params: MealListParams, ifNoneMatch?: string) {
    return this.http.getConditional<Paginated<MealListItem[]>>("/meals", {
      query: toQuery({
        page: params.page,
        limit: params.limit,
        category_id: params.category_id,
        gender: params.gender,
        is_challenge: params.is_challenge,
        weight: params.weight,
        search: params.search,
        lang: params.lang,
      }),
      ifNoneMatch,
    });
  }

  getMeal(id: number, params: { lang: string }) {
    return this.http.getData<MealDetail>(`/meals/${id}`, {
      query: toQuery({ lang: params.lang }),
    });
  }

  getWorkoutLevels(params: { lang: string }) {
    return this.http.getData<WorkoutLevel[]>("/workout-levels", {
      query: toQuery({ lang: params.lang }),
    });
  }

  getWorkoutCategories(params: WorkoutCategoryListParams) {
    return this.http.getPaginated<WorkoutCategory[]>("/workout-categories", {
      query: toQuery({
        page: params.page,
        limit: params.limit,
        level_id: params.level_id,
        gender: params.gender,
        is_challenge: params.is_challenge,
        lang: params.lang,
      }),
    });
  }

  getExercises(params: ExerciseListParams) {
    return this.http.getPaginated<ExerciseListItem[]>("/exercises", {
      query: toQuery({
        page: params.page,
        limit: params.limit,
        category_id: params.category_id,
        level_id: params.level_id,
        browse_key: params.browse_key,
        gender: params.gender,
        is_challenge: params.is_challenge,
        weight: params.weight,
        search: params.search,
        lang: params.lang,
      }),
    });
  }

  getExercise(id: number, params: { lang: string; level_id?: number }) {
    return this.http.getData<ExerciseDetail>(`/exercises/${id}`, {
      query: toQuery({ lang: params.lang, level_id: params.level_id }),
    });
  }
}

export function createClient(options: WeightLossClientOptions) {
  return new WeightLossClient(options);
}
