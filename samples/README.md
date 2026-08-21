# Import samples (raw JSON + CSV)

Same records and **matching IDs** in both formats. Meals point at meal categories; workout categories/exercises point at levels.

| Resource | IDs | Links |
| --- | --- | --- |
| Meal categories | 1 Breakfast, 2 Lunch, 3 Dinner | — |
| Meals | 1 Parfait → **1**, 2 Chicken bowl → **2**, 3 Salmon → **3**, 4 Berry salad → **1\|2** | `categoryIds` / `category_ids` |
| Workout levels | 1 Beginner, 2 Intermediate | — |
| Workout categories | 1 Full Body → **1**, 2 Cardio → **1\|2** | `levelIds` / `level_ids` |
| Exercises | 1 Squat → cat **1** / lvl **1**, 2 Jacks → cat **2** / lvl **1**, 3 Climbers → cat **1\|2** / lvl **1\|2** | `categoryIds` + `levelIds` |

Import **parents first**, then children:

1. Meal categories → meals
2. Workout levels → workout categories → exercises

Raw and CSV use the **same ids**. Importing CSV after raw upserts the same rows (does not duplicate).

## Raw JSON

Admin → **Raw Upload** (`/admin/data/raw-upload`), or files in `samples/raw-upload/`.

## CSV

Admin → **Import CSV** (`/admin/data/import-csv`), or files in `samples/csv-import/`.

Keep **First row contains headers** checked. Multiple ids use `|` (example: `1|2`).

English-only is enough — other locales fill after import.
