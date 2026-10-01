/**
 * @vitest-environment jsdom
 */
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { RouteError } from "./route-error";

/**
 * Render `path` through a real router (jsdom + createRoot — `renderToString`
 * bails on error boundaries) where an `_org`-child route throws, and return
 * the mounted element.
 */
async function renderPath(path: string): Promise<HTMLElement> {
  const rootRoute = createRootRoute({ errorComponent: RouteError });
  const orgChildRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/org/boom",
    component: () => {
      throw new Error("kaboom");
    },
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([orgChildRoute]),
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(() => {
    root.render(<RouterProvider router={router} />);
  });
  return container;
}

describe("RouteError", () => {
  // B4: the old error view mounted <AppSidebar/>, which throws outside
  // <OrgConnection/> — the error page crashed instead of rendering.
  it("renders an error thrown in a layout child, standalone", async () => {
    const container = await renderPath("/org/boom");
    expect(container.textContent).toContain("Something went wrong");
    expect(container.textContent).toContain("kaboom");
    expect(container.textContent).toContain("Try Again");
    expect(container.textContent).toContain("Go Home");
    expect(container.textContent).not.toContain("Chats");
  });
});
