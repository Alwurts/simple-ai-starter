import { createFileRoute } from "@tanstack/react-router";
import { LoginPage } from "@/components/auth/login-page";

export const Route = createFileRoute("/_auth/login")({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => {
    const redirect = search.redirect;
    return typeof redirect === "string" ? { redirect } : {};
  },
  component: LoginPage,
});
