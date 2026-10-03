import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { auth } from "@workspace/auth";
import { Shell, ShellInset } from "@workspace/ui/components/brand/shell";
import { OrgConnection } from "@/components/chat/connection/org-connection";
import { ChatDockStage, ChatTabFooter } from "@/components/chat/dock/chat-dock";
import { ChatDockProvider } from "@/components/chat/dock/dock-context";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { RouteError } from "@/components/layout/route-error";
import { useActiveOrganizationId } from "@/hooks/organization/use-organization";

const ensureActiveOrg = createServerFn({ method: "GET" }).handler(async () => {
  const headers = getRequestHeaders();
  const session = await auth.api.getSession({ headers });

  if (!session) {
    return { session: null, needsOnboarding: false };
  }

  // Better Auth keeps a stale `activeOrganizationId` after an admin removes
  // the member, so the session stamp alone would let a removed user into the
  // org shell (empty data, chats "Loading…" forever). Verify the membership
  // is live; if not, clear the stale org and fall through to the
  // list-first-org-or-onboarding logic.
  if (session.session.activeOrganizationId) {
    const member = await auth.api
      .getActiveMember({ headers })
      .catch(() => null);
    if (member) {
      return { session, needsOnboarding: false };
    }
    await auth.api.setActiveOrganization({
      headers,
      body: { organizationId: null },
    });
  }

  const organizations = await auth.api.listOrganizations({ headers });
  const first = organizations[0];

  if (!first) {
    return { session, needsOnboarding: true };
  }

  await auth.api.setActiveOrganization({
    headers,
    body: { organizationId: first.id },
  });

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
 * One org agent socket for the sidebar list and the dock. The chat window
 * covers the page. Desktop tabs sit under the inset card. Keyed by org
 * so a switch drops the previous socket.
 */
function OrgLayout() {
  const organizationId = useActiveOrganizationId();
  // `ensureActiveOrg` guarantees an active org past the guard; the session
  // query just resolves a tick later on first paint.
  if (!organizationId) {
    return null;
  }
  return (
    <OrgConnection key={organizationId} organizationId={organizationId}>
      <ChatDockProvider>
        <Shell sidebar={<AppSidebar />}>
          <ShellInset>
            <ChatDockStage>
              <Outlet />
            </ChatDockStage>
          </ShellInset>
          <ChatTabFooter />
        </Shell>
      </ChatDockProvider>
    </OrgConnection>
  );
}
