import { createFileRoute } from "@tanstack/react-router";
import { SignUpPage } from "@/components/auth/signup-page";

export const Route = createFileRoute("/_auth/signup")({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => {
    const redirect = search.redirect;
    return typeof redirect === "string" ? { redirect } : {};
  },
  component: SignUpPage,
});
