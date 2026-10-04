import { describe, expect, it } from "vitest";
import {
  filterName,
  filterSlug,
  organizationSlugSchema,
  slugFromName,
} from "./organization-form";

describe("filterName", () => {
  it("keeps accented letters", () => {
    expect(filterName("José Café")).toBe("José Café");
  });

  it("keeps & and strips characters outside letters, numbers, space, - _ '", () => {
    expect(filterName("Acme <script>alert(1)</script>")).toBe(
      "Acme scriptalert1script"
    );
    expect(filterName("O'Neill & Co-2_3")).toBe("O'Neill & Co-2_3");
  });
});

describe("slugFromName", () => {
  it("folds diacritics into an ASCII slug", () => {
    expect(slugFromName("José Café")).toBe("jose-cafe");
  });

  it("drops & and still satisfies the slug rule", () => {
    const slug = slugFromName("O'Neill & Co");
    expect(slug).toBe("oneill-co");
    expect(organizationSlugSchema.safeParse(slug).success).toBe(true);
  });

  it("keeps the slug rule satisfied for unicode names", () => {
    const slug = slugFromName("Crème Brûlée Co");
    expect(organizationSlugSchema.safeParse(slug).success).toBe(true);
  });
});

describe("filterSlug", () => {
  it("lowercases input is untouched; stray chars collapse", () => {
    expect(filterSlug("my--org--")).toBe("my-org");
    expect(filterSlug("ab#c!d")).toBe("abcd");
    expect(filterSlug("my_org")).toBe("myorg");
  });
});

describe("organizationSlugSchema", () => {
  it("accepts lowercase letters, numbers and hyphens (3–50 chars)", () => {
    expect(organizationSlugSchema.safeParse("acme-co").success).toBe(true);
    expect(organizationSlugSchema.safeParse("ab").success).toBe(false);
    expect(organizationSlugSchema.safeParse("Acme").success).toBe(false);
    expect(organizationSlugSchema.safeParse("josé").success).toBe(false);
  });
});
