import { createFileRoute } from "@tanstack/react-router";
import { SettingsLayout } from "@/components/organization/settings/settings-layout";

export const Route = createFileRoute("/_protected/_org/settings")({
  component: SettingsLayout,
});
