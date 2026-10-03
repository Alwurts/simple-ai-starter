import {
  createFileRoute,
  Link,
  Outlet,
  useRouterState,
} from "@tanstack/react-router";
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
import { cn } from "@workspace/ui/lib/utils";
import {
  type AppBreadcrumbItem,
  AppBreadcrumbs,
} from "@/components/layout/app-breadcrumbs";

const SETTINGS_SECTIONS = [
  { title: "General", to: "/settings/general" },
  { title: "Members", to: "/settings/members" },
] as const;

function useSettingsCrumbs(): AppBreadcrumbItem[] {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // `/settings` redirects to General, so the pathname is always a section.
  const section = pathname.endsWith("/members") ? "Members" : "General";
  return [{ title: "Settings" }, { title: section }];
}

function SettingsLayout() {
  const { data: activeOrganization, isPending } =
    authClient.useActiveOrganization();
  const crumbs = useSettingsCrumbs();

  if (isPending) {
    return (
      <ShellPage>
        <ShellHeader>
          <ShellHeaderSidebarTrigger className="-ml-1" />
          <AppBreadcrumbs items={crumbs} />
          <ShellHeaderActions />
        </ShellHeader>
        <ShellContent>
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-64 w-full" />
        </ShellContent>
      </ShellPage>
    );
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
            <Button nativeButton={false} render={<Link to="/onboarding" />}>
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
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <SettingsSectionNav />
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-4xl space-y-8 px-4 py-6 md:px-6 md:py-8">
              <Outlet />
            </div>
          </div>
        </div>
      </ShellContent>
    </ShellPage>
  );
}

function SettingsSectionNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav
      aria-label="Settings"
      className="flex shrink-0 gap-1 border-b px-3 py-2 md:w-48 md:flex-col md:border-r md:border-b-0 md:px-2 md:py-4"
    >
      <p className="hidden px-2 pb-1 font-medium text-muted-foreground text-xs md:block">
        Organization
      </p>
      {SETTINGS_SECTIONS.map((section) => {
        const active =
          pathname === section.to || pathname.startsWith(`${section.to}/`);
        return (
          <Link
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-md px-2 py-1.5 text-sm",
              active
                ? "bg-muted font-medium text-foreground"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            )}
            key={section.to}
            to={section.to}
          >
            {section.title}
          </Link>
        );
      })}
    </nav>
  );
}

export const Route = createFileRoute("/_protected/_org/settings")({
  component: SettingsLayout,
});
