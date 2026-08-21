# Index verification (explain executionStats)

| Route probe | Collection | Stage | Keys examined | Docs examined | Returned | ms |
|---|---|---|---:|---:|---:|---:|
| mealCategories.public | mealCategories | IXSCAN | 0 | 0 | 0 | 41 |
| meals.byCategory.public | meals | SORT | 0 | 0 | 0 | 30 |
| meals.byId | meals | IXSCAN | 0 | 0 | 0 | 0 |
| workoutLevels.public | workoutLevels | IXSCAN | 0 | 0 | 0 | 0 |
| workoutCategories.byLevel | workoutCategories | SORT | 0 | 0 | 0 | 0 |
| exercises.byBrowseKey | exercises | SORT | 0 | 0 | 0 | 1 |
| exercises.byId | exercises | IXSCAN | 0 | 0 | 0 | 0 |
