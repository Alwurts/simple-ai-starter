import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { authClient } from "@workspace/auth/client";
import {
  ShellContent,
  ShellHeader,
  ShellHeaderActions,
  ShellHeaderSidebarTrigger,
  ShellPage,
} from "@workspace/ui/components/brand/shell";
import { Button } from "@workspace/ui/components/shadcn/button";
import { Skeleton } from "@workspace/ui/components/shadcn/skeleton";
import {
  type AppBreadcrumbItem,
  AppBreadcrumbs,
} from "@/components/layout/app-breadcrumbs";
import {
  type SettingsNavSection,
  SettingsSectionLayout,
} from "@/components/organization/settings/settings-section-layout";

function settingsSections(): SettingsNavSection[] {
  return [
    {
      label: "Organization",
      items: [
        {
          to: "/settings/general",
          label: "General",
        },
        {
          to: "/settings/members",
          label: "Members",
        },
      ],
    },
  ];
}

function useSettingsCrumbs(): AppBreadcrumbItem[] {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // `/settings` redirects to General, so the pathname is always a section.
  const section = pathname.endsWith("/members") ? "Members" : "General";
  return [{ title: "Settings" }, { title: section }];
}

export function SettingsLayout() {
  const { data: activeOrganization, isPending } =
    authClient.useActiveOrganization();
  const sections = settingsSections();
  const crumbs = useSettingsCrumbs();
  if (isPending) {
    return <SettingsSkeleton crumbs={crumbs} sections={sections} />;
  }
  if (!activeOrganization) {
    return (
      <ShellPage>
        <ShellHeader>
          <ShellHeaderSidebarTrigger className="-ml-1" />
          <AppBreadcrumbs items={crumbs} />
          <ShellHeaderActions />
        </ShellHeader>
        <ShellContent>
          <div className="flex h-[50vh] flex-col items-center justify-center gap-4">
            <p className="text-muted-foreground">No active organization</p>
            <Button render={<Link to="/onboarding" />}>
              Create an organization
            </Button>
          </div>
        </ShellContent>
      </ShellPage>
    );
  }
  return (
    <ShellPage>
      <ShellHeader>
        <ShellHeaderSidebarTrigger className="-ml-1" />
        <AppBreadcrumbs items={crumbs} />
        <ShellHeaderActions />
      </ShellHeader>

      <ShellContent>
        <SettingsSectionLayout sections={sections}>
          <Outlet />
        </SettingsSectionLayout>
      </ShellContent>
    </ShellPage>
  );
}
function SettingsSkeleton({
  crumbs,
  sections,
}: {
  crumbs: AppBreadcrumbItem[];
  sections: SettingsNavSection[];
}) {
  return (
    <ShellPage>
      <ShellHeader>
        <ShellHeaderSidebarTrigger className="-ml-1" />
        <AppBreadcrumbs items={crumbs} />
        <ShellHeaderActions />
      </ShellHeader>
      <ShellContent>
        <SettingsSectionLayout sections={sections}>
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-64 w-full" />
        </SettingsSectionLayout>
      </ShellContent>
    </ShellPage>
  );
}
