import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_protected/_org/settings/")({
  beforeLoad: () => {
    throw redirect({ to: "/settings/general", replace: true });
  },
});
