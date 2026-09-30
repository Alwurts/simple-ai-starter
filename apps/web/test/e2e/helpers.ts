import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Wait until TanStack Start has hydrated the page.
 *
 * The SSR bootstrap script installs `self.$_TSR` with an `h()` hook
 * (@tanstack/router-core `ssr/tsrScript.js`); `@tanstack/react-start-client`'s
 * `hydrateStart()` calls `window.$_TSR?.h()` — "signals hydration completion" —
 * which sets `hydrated = true` and then deletes the global once the SSR stream
 * has ended too. Either state means React owns the DOM, so typed input can no
 * longer be reset by hydration. Fills before this point can be silently lost
 * (or submitted natively, bypassing react-hook-form).
 */
export async function waitHydrated(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const tsr = (window as { $_TSR?: { hydrated?: boolean } }).$_TSR;
    return !tsr || tsr.hydrated === true;
  });
}

/**
 * Fill an input and verify the value stuck, retrying on loss.
 *
 * Client-side navigations swap lazily-loaded route components after the URL
 * changes, and that one-shot remount resets react-hook-form state — a plain
 * fill can land on the interim DOM and be wiped ~50ms later. Filling inside
 * `expect(...).toPass()` re-fills the new element instead of failing; there is
 * no sleep, and once the value survives an assertion the route is settled.
 */
export async function fillValue(
  locator: Locator,
  value: string
): Promise<void> {
  await expect(async () => {
    await locator.fill(value);
    await expect(locator).toHaveValue(value);
  }).toPass({ timeout: 15_000 });
}

/**
 * Wait for a fresh network-quiet window, starting now.
 *
 * `page.waitForLoadState("networkidle")` resolves immediately once the state
 * has been reached, so after a client-side navigation (URL changes while lazy
 * route chunks are still loading) it no longer guards anything. This waits
 * for 500ms with no request activity measured from the call — the same
 * definition Playwright uses for networkidle, but re-armed. Best-effort: it
 * gives up after `timeoutMs` so unknown long-pollers can't hang a test.
 */
export async function waitForRouteSettled(
  page: Page,
  quietMs = 500,
  timeoutMs = 15_000
): Promise<void> {
  let inflight = 0;
  let lastActivity = Date.now();
  const onRequest = () => {
    inflight++;
    lastActivity = Date.now();
  };
  const onSettled = () => {
    inflight--;
    lastActivity = Date.now();
  };
  page.on("request", onRequest);
  page.on("requestfinished", onSettled);
  page.on("requestfailed", onSettled);
  const started = Date.now();
  try {
    while (inflight > 0 || Date.now() - lastActivity < quietMs) {
      if (Date.now() - started >= timeoutMs) {
        return;
      }
      await new Promise((r) => setTimeout(r, 50));
    }
  } finally {
    page.off("request", onRequest);
    page.off("requestfinished", onSettled);
    page.off("requestfailed", onSettled);
  }
}
