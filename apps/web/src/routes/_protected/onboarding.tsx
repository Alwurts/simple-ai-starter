import { createFileRoute } from "@tanstack/react-router";
import { OnboardingPage } from "@/components/organization/onboarding-page";

export const Route = createFileRoute("/_protected/onboarding")({
  component: OnboardingPage,
});
