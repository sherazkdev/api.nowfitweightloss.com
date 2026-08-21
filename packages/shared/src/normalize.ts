export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizeSlug(slug: string): string {
  return slug.trim().toLowerCase();
}

export function normalizeSearchText(value: string): string {
  return value.trim().toLowerCase();
}
