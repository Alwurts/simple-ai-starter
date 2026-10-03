import { slug as slugify } from "github-slugger";
import { z } from "zod";

/**
 * The one slug rule, shared by the create-organization and
 * edit-organization forms (client-only rule; the API is not involved).
 */
export const SLUG_PATTERN = /^[a-z0-9-]+$/;

export const organizationSlugSchema = z
  .string()
  .min(3, { message: "Slug must be at least 3 characters" })
  .max(50, { message: "Slug must be less than 50 characters" })
  .regex(SLUG_PATTERN, {
    message: "Slug can only contain lowercase letters, numbers, and hyphens",
  });

/**
 * Display-name input filter. Letters are never stripped, so accents survive
 * ("José" stays "José"); the slug derivation folds them instead.
 */
export const filterName = (name: string) =>
  name.replace(/[^\p{L}\p{N}\s\-_']/gu, "");

const MULTIPLE_HYPHENS_REGEX = /-{2,}/g;
const TRAILING_HYPHEN_REGEX = /-+$/;

export const filterSlug = (slug: string) =>
  slug
    .replace(/[^a-z0-9-]/g, "")
    .replace(MULTIPLE_HYPHENS_REGEX, "-")
    .replace(TRAILING_HYPHEN_REGEX, "");

/**
 * ASCII slug auto-derived from a display name — diacritics fold for the slug
 * only ("José" → "jose"), so the shared slug rule still accepts it.
 */
export const slugFromName = (name: string) =>
  filterSlug(slugify(name.normalize("NFD").replace(/\p{Diacritic}/gu, "")));
