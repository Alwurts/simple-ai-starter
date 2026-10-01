import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { auth } from "@workspace/auth";
import { Shell, ShellInset } from "@workspace/ui/components/brand/shell";
import { OrgConnection } from "@/components/chat/connection/org-connection";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { RouteError } from "@/components/layout/route-error";
import { useActiveOrganizationId } from "@/hooks/organization/use-organization";

const ensureActiveOrg = createServerFn({ method: "GET" }).handler(async () => {
  const headers = getRequestHeaders();
  const session = await auth.api.getSession({ headers });

  if (!session) {
    return { session: null, needsOnboarding: false };
  }

  if (!session.session.activeOrganizationId) {
    const organizations = await auth.api.listOrganizations({ headers });
    const first = organizations[0];

    if (!first) {
      return { session, needsOnboarding: true };
    }

    await auth.api.setActiveOrganization({
      headers,
      body: { organizationId: first.id },
    });
  }

  return { session, needsOnboarding: false };
});

export const Route = createFileRoute("/_protected/_org")({
  beforeLoad: async () => {
    const result = await ensureActiveOrg();

    // `_protected` already bounces signed-out users; this stays as a
    // defence-in-depth check because the server fn is reachable on its own.
    if (!result.session) {
      throw redirect({
        to: "/login",
      });
    }

    if (result.needsOnboarding) {
      throw redirect({
        to: "/onboarding",
      });
    }
  },
  component: OrgLayout,
  errorComponent: RouteError,
});

/**
 * The chat is the signed-in home, so the org's agent connection wraps the
 * whole org area: the sidebar thread list and the chat page share one
 * `OrgAgent` socket.
 */
function OrgLayout() {
  const organizationId = useActiveOrganizationId();
  // `ensureActiveOrg` guarantees an active org past the guard; the session
  // query just resolves a tick later on first paint.
  if (!organizationId) {
    return null;
  }
  return (
    // Keyed by org so a switch remounts the connection — without it the old
    // org's socket (and its chat list) lingers into the new org until state
    // happens to catch up, 404-reconnecting all the while.
    <OrgConnection key={organizationId} organizationId={organizationId}>
      <Shell sidebar={<AppSidebar />}>
        <ShellInset>
          <Outlet />
        </ShellInset>
      </Shell>
    </OrgConnection>
  );
}
