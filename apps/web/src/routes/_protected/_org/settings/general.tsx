import { createFileRoute } from "@tanstack/react-router";
import { GeneralSettingsPage } from "@/components/organization/settings/general-settings-page";

export const Route = createFileRoute("/_protected/_org/settings/general")({
  component: GeneralSettingsPage,
});
