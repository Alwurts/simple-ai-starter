"use client";

import { useNavigate } from "@tanstack/react-router";
import { authClient } from "@workspace/auth/client";
import { APP_NAME } from "@workspace/ui/components/brand/auth-page";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/shadcn/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/shadcn/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@workspace/ui/components/shadcn/sidebar";
import { Skeleton } from "@workspace/ui/components/shadcn/skeleton";
import { AlertCircle, CheckIcon, ChevronsUpDown, Plus } from "lucide-react";
import { useSetActiveOrganization } from "@/hooks/organization/use-set-active-organization";

function orgInitials(name: string | undefined) {
  return name?.slice(0, 2).toUpperCase() ?? "??";
}

function OrgSwitcherSkeleton() {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton aria-label="Loading organization" disabled size="lg">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <div className="grid flex-1 text-left text-sm leading-tight">
            <Skeleton className="mb-1 h-4 w-24" />
            <Skeleton className="h-3 w-16" />
          </div>
          <ChevronsUpDown className="ml-auto size-4" />
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

function OrgSwitcherError() {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton disabled size="lg">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-destructive/10">
            <AlertCircle className="h-4 w-4 text-destructive" />
          </div>
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-semibold text-destructive">
              Authentication Error
            </span>
            <span className="truncate text-muted-foreground text-xs">
              Please sign in again
            </span>
          </div>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

/**
 * The sidebar header's team switcher (shadcn pattern): the active org's
 * avatar, name and the app name as subtitle; the menu lists the user's orgs
 * with a check on the active one and hands off to onboarding to create one.
 */
export function OrgSwitcher() {
  const { isMobile } = useSidebar();
  const navigate = useNavigate();
  const setActiveOrganization = useSetActiveOrganization();
  const {
    data: session,
    isPending: isSessionPending,
    error,
  } = authClient.useSession();
  const { data: organizations } = authClient.useListOrganizations();
  const { data: activeOrganization, isPending: isOrgPending } =
    authClient.useActiveOrganization();

  const user = session?.user;
  const displayOrganization =
    activeOrganization ??
    organizations?.find(
      (organization) =>
        organization.id === session?.session.activeOrganizationId
    ) ??
    organizations?.[0] ??
    null;
  const isPending = isSessionPending || (isOrgPending && !displayOrganization);

  if (isPending) {
    return <OrgSwitcherSkeleton />;
  }
  if (error || !user) {
    return <OrgSwitcherError />;
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                className="data-popup-open:bg-sidebar-accent data-popup-open:text-sidebar-accent-foreground"
                size="lg"
                tooltip={displayOrganization?.name ?? "Organization"}
              />
            }
          >
            <Avatar className="h-8 w-8 rounded-lg">
              <AvatarImage
                alt={displayOrganization?.name ?? "Organization"}
                src={displayOrganization?.logo ?? undefined}
              />
              <AvatarFallback className="rounded-lg">
                {orgInitials(displayOrganization?.name)}
              </AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-semibold">
                {displayOrganization?.name ?? "No organization"}
              </span>
              <span className="truncate text-muted-foreground text-xs">
                {APP_NAME}
              </span>
            </div>
            <ChevronsUpDown className="ml-auto size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-muted-foreground text-xs">
                Organizations
              </DropdownMenuLabel>
              {organizations?.map((organization) => {
                const isActive =
                  organization.id ===
                  (activeOrganization?.id ??
                    session?.session.activeOrganizationId);
                return (
                  <DropdownMenuItem
                    className="gap-2 p-2"
                    key={organization.id}
                    onClick={() =>
                      setActiveOrganization.mutate(organization.id)
                    }
                  >
                    <Avatar className="size-6 rounded-sm">
                      <AvatarImage src={organization.logo ?? undefined} />
                      <AvatarFallback className="rounded-sm">
                        {orgInitials(organization.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="min-w-0 flex-1 truncate">
                      {organization.name}
                    </span>
                    {isActive ? <CheckIcon className="size-4" /> : null}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="gap-2 p-2"
              onClick={() =>
                navigate({
                  to: "/onboarding",
                })
              }
            >
              <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
                <Plus className="size-4" />
              </div>
              <div className="font-medium text-muted-foreground">
                Create organization
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
