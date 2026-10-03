import { authClient } from "@workspace/auth/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/shadcn/card";
import { Separator } from "@workspace/ui/components/shadcn/separator";
import { CreateOrganizationDialog } from "@/components/organization/create-organization-dialog";
import { OrganizationDangerZone } from "@/components/organization/settings/organization-danger-zone";
import { OrganizationDetailsForm } from "@/components/organization/settings/organization-details-form";

export function GeneralSettingsPage() {
  const { data: activeOrganization } = authClient.useActiveOrganization();

  if (!activeOrganization) {
    return null;
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Organization details</CardTitle>
          <CardDescription>
            Update your organization name and slug
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OrganizationDetailsForm organization={activeOrganization} />
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="font-medium text-sm">New organization</p>
          <p className="text-muted-foreground text-sm">
            Create another organization and switch to it.
          </p>
        </div>
        <CreateOrganizationDialog />
      </div>

      <Separator />

      <OrganizationDangerZone organization={activeOrganization} />
    </div>
  );
}
