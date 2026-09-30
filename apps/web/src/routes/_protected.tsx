import { createFileRoute, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { auth } from "@workspace/auth";

const requireSession = createServerFn({ method: "GET" }).handler(() => {
  const headers = getRequestHeaders();
  return auth.api.getSession({ headers });
});

export const Route = createFileRoute("/_protected")({
  beforeLoad: async ({ location }) => {
    const session = await requireSession();
    if (!session) {
      throw redirect({
        to: "/login",
        search: { redirect: location.href },
      });
    }

    return { user: session.user };
  },
});
