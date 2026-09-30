import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { auth } from "@workspace/auth";
import { AuthPage } from "@/components/common/auth-page";

const isSignedIn = createServerFn({ method: "GET" }).handler(async () => {
  const headers = getRequestHeaders();
  const session = await auth.api.getSession({ headers });
  return session !== null;
});

function AuthLayout() {
  return (
    <AuthPage>
      <Outlet />
    </AuthPage>
  );
}

export const Route = createFileRoute("/_auth")({
  beforeLoad: async () => {
    if (await isSignedIn()) {
      throw redirect({ to: "/" });
    }
  },
  component: AuthLayout,
});
