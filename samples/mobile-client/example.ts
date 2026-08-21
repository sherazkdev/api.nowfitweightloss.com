/**
 * Example: fetch public content with @weightloss/client
 *
 * Run (API must be up on :5000):
 *   npm run build:client
 *   npx tsx samples/mobile-client/example.ts
 */
import { createClient, WeightLossApiError } from "@weightloss/client";

async function main() {
  const client = createClient({
    baseUrl: process.env.API_PUBLIC_URL ?? "http://localhost:5000",
    apiVersion: "v1",
  });

  try {
    const meta = await client.getMeta();
    console.log("API version:", meta.version);
    console.log("Endpoints:", meta.endpoints.length);

    const categories = await client.getMealCategories({ lang: "en" });
    console.log("Meal categories:", categories.length);

    const meals = await client.getMeals({ page: 1, limit: 5, gender: "female", lang: "en" });
    console.log("Meals page:", meals.pagination.page, "total:", meals.pagination.total);
    console.log("First meal:", meals.data[0]?.title ?? "(none)");

    const levels = await client.getWorkoutLevels({ lang: "en" });
    console.log("Workout levels:", levels.length);
  } catch (error) {
    if (error instanceof WeightLossApiError) {
      console.error(`API error [${error.code}]: ${error.message}`);
      process.exit(1);
    }
    throw error;
  }
}

void main();
