import { applyD1Migrations, env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

// Guard for ADR-007: Cloudflare D1 + Drizzle table-recreate migrations & FK cascades.
//
// `drizzle-kit generate` wraps its SQLite table-recreate pattern in
// `PRAGMA foreign_keys=OFF; … DROP TABLE x; … PRAGMA foreign_keys=ON;`.
// On Cloudflare D1 that pragma is a NO-OP: D1 runs every migration inside an
// implicit transaction, and SQLite ignores `PRAGMA foreign_keys` within a
// transaction. So the `DROP TABLE` fires inbound `ON DELETE SET NULL`/`CASCADE`
// foreign keys and silently destroys data — an inbound `ON DELETE SET NULL`
// gets nulled in production while the same migration passes locally.
//
// Cloudflare's documented fix is `PRAGMA defer_foreign_keys=true` (valid inside
// a transaction, auto-resets at COMMIT). So no migration may rely on
// `PRAGMA foreign_keys=OFF`. After `pnpm db:generate`, hand-edit any generated
// recreate migration to swap it.
// See docs/decisions/007-d1-drizzle-table-recreate-fk-cascades.md
//
// Two intentional diffs from a plain-node guard, both forced by this
// repo's test layout:
//  - source: the migrations are already parsed into the `TEST_MIGRATIONS`
//    binding by vitest.config.ts (readD1Migrations, run in Node at config time,
//    since `@workspace/db` ships no test runner and this suite runs in the
//    Cloudflare workers pool — which sandboxes `node:fs`). So we read the
//    binding instead of `readdirSync`/`readFileSync`.
//  - grandfather list: the starter ships this guard from day one and its
//    existing migrations contain no `PRAGMA foreign_keys=OFF`, so it is empty.

// Migrations already applied to production before this guard existed. The
// starter's existing migrations are clean, so this starts empty. Do not add new
// entries here to silence the guard; fix the migration instead. Fixes are
// forward-only — never rewrite an applied migration.
const GRANDFATHERED = new Set<string>([]);

// Drizzle's emitted pragma, tolerant of spacing/case: `PRAGMA foreign_keys=OFF`.
const INEFFECTIVE_FK_PRAGMA = /pragma\s+foreign_keys\s*=\s*off/i;

// D1's foreign-key violation, proving the recreated table enforces the FK.
const FK_CONSTRAINT = /FOREIGN KEY/;

// `D1Migration = { name: string; queries: string[] }`. readD1Migrations already
// sorts by filename; sort again so the offenders message is deterministic.
const migrationFiles = [...env.TEST_MIGRATIONS].sort((a, b) =>
  a.name.localeCompare(b.name)
);

const sqlOf = (name: string): string => {
  const m = migrationFiles.find((f) => f.name === name);
  return m ? m.queries.join("\n") : "";
};

describe("D1 migration safety (ADR-007)", () => {
  it("has migration files to check", () => {
    expect(migrationFiles.length).toBeGreaterThan(0);
  });

  it("no new migration relies on the ineffective `PRAGMA foreign_keys=OFF`", () => {
    const offenders = migrationFiles
      .filter((f) => !GRANDFATHERED.has(f.name))
      .filter((f) => INEFFECTIVE_FK_PRAGMA.test(f.queries.join("\n")));

    const message =
      offenders.length === 0
        ? ""
        : [
            "Migration(s) use `PRAGMA foreign_keys=OFF`, a NO-OP on Cloudflare D1 (migrations",
            "run inside an implicit transaction). A `DROP TABLE` in a drizzle table-recreate will",
            "fire inbound ON DELETE cascades and destroy data.",
            "Fix: replace `PRAGMA foreign_keys=OFF;` with `PRAGMA defer_foreign_keys=true;` and",
            "remove the trailing `PRAGMA foreign_keys=ON;`.",
            "See docs/decisions/007-d1-drizzle-table-recreate-fk-cascades.md",
            `Offending file(s): ${offenders.map((f) => f.name).join(", ")}`,
          ].join(" ");

    expect(offenders, message).toEqual([]);
  });

  it("keeps the grandfather allowlist honest", () => {
    for (const f of GRANDFATHERED) {
      expect(
        migrationFiles.map((m) => m.name),
        `grandfathered migration missing: ${f}`
      ).toContain(f);
      // If a grandfathered file no longer has the legacy pragma, the allowlist
      // entry is dead config and should be removed.
      const sql = sqlOf(f);
      expect(
        INEFFECTIVE_FK_PRAGMA.test(sql),
        `${f} no longer contains \`foreign_keys=OFF\` — drop it from GRANDFATHERED`
      ).toBe(true);
    }
  });
});

describe("0001 over a database with orphaned products", () => {
  const m0 = migrationFiles.find((f) => f.name.startsWith("0000"));
  const m1 = migrationFiles.find((f) => f.name.startsWith("0001"));

  function sqlFor(m: { queries: string[] } | undefined) {
    if (!m) {
      throw new Error("migration missing from TEST_MIGRATIONS");
    }
    return m;
  }

  it("drops products of deleted organizations and keeps the rest (no COMMIT rollback)", async () => {
    // The setup file applied every migration; rebuild the pre-0001 state:
    // empty database → 0000 → data as an org-deleting app could have left it.
    for (const table of [
      "products",
      "verification",
      "session",
      "member",
      "invitation",
      "account",
      "organization",
      "user",
      "d1_migrations",
    ]) {
      await env.DB.prepare(`DROP TABLE IF EXISTS ${table}`).run();
    }
    await applyD1Migrations(env.DB, [sqlFor(m0)]);

    const orgId = crypto.randomUUID();
    await env.DB.prepare(
      "INSERT INTO organization (id, name, slug) VALUES (?, 'Keep Org', ?)"
    )
      .bind(orgId, `keep-${orgId.slice(0, 8)}`)
      .run();
    await env.DB.prepare(
      "INSERT INTO products (id, organization_id, name, created_at, updated_at) VALUES ('p_keep', ?, 'Kept', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')"
    )
      .bind(orgId)
      .run();
    // The org was deleted before products had an FK — the row is unreachable
    // through the app but still present.
    await env.DB.prepare(
      "INSERT INTO products (id, organization_id, name, created_at, updated_at) VALUES ('p_orphan', 'deleted-org', 'Orphan', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')"
    ).run();

    // Must succeed: without the orphan cleanup the deferred FK check fails at
    // COMMIT and the whole migration rolls back, blocking deploys.
    await applyD1Migrations(env.DB, [sqlFor(m1)]);

    const { results } = await env.DB.prepare("SELECT id FROM products").all<{
      id: string;
    }>();
    expect(results.map((row) => row.id)).toEqual(["p_keep"]);

    // The FK is live after the recreate: an orphan insert fails with the FK
    // violation, not a NOT NULL miss (both timestamp columns are NOT NULL).
    const fkError = await env.DB.prepare(
      "INSERT INTO products (id, organization_id, name, created_at, updated_at) VALUES ('p_new', 'no-such-org', 'X', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')"
    )
      .run()
      .then(
        () => null,
        (error: unknown) => error
      );
    expect(fkError).toBeInstanceOf(Error);
    expect((fkError as Error).message).toMatch(FK_CONSTRAINT);
  });
});
