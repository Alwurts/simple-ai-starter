import { createFileRoute } from "@tanstack/react-router";
import { MembersSettingsPage } from "@/components/organization/settings/members-settings-page";

export const Route = createFileRoute("/_protected/_org/settings/members")({
  component: MembersSettingsPage,
});
