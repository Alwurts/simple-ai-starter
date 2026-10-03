"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { authClient } from "@workspace/auth/client";
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
import {
  AlertCircle,
  CheckIcon,
  ChevronsUpDown,
  LogOut,
  Settings,
} from "lucide-react";
import { ThemeMenuItem } from "@/components/common/theme-toggle";
import { useSetActiveOrganization } from "@/hooks/organization/use-set-active-organization";

function orgInitials(name: string | undefined) {
  return name?.slice(0, 2).toUpperCase() ?? "??";
}

function orgMark(name: string | undefined) {
  const letter = name?.trim().charAt(0).toUpperCase();
  return letter || "?";
}

function FooterSkeleton() {
  return (
    <div className="flex h-8 items-center gap-1">
      <Skeleton className="h-8 min-w-0 flex-1 rounded-md" />
      <Skeleton className="size-8 shrink-0 rounded-full" />
    </div>
  );
}

function FooterError() {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton disabled>
          <AlertCircle className="text-destructive" />
          <span className="truncate text-destructive">
            Authentication error
          </span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

/**
 * Sidebar footer. The organization control only switches organizations.
 * The account control is theme, Settings, and Sign out. Creating an
 * organization lives on Organization settings.
 */
export function AppSidebarFooter() {
  const { isMobile } = useSidebar();
  const menuSide = isMobile ? "bottom" : "right";
  const navigate = useNavigate();
  const queryClient = useQueryClient();
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

  const handleSignOut = async () => {
    await authClient.signOut();
    queryClient.clear();
    navigate({
      to: "/login",
    });
  };

  if (isPending) {
    return <FooterSkeleton />;
  }
  if (error || !user) {
    return <FooterError />;
  }

  const organizationName = displayOrganization?.name ?? "No organization";

  return (
    <SidebarMenu className="flex-row items-center gap-1 group-data-[collapsible=icon]:flex-col">
      <SidebarMenuItem className="min-w-0 flex-1 group-data-[collapsible=icon]:w-auto group-data-[collapsible=icon]:flex-none">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                className="data-popup-open:bg-sidebar-accent data-popup-open:text-sidebar-accent-foreground group-data-[collapsible=icon]:p-1.5!"
                tooltip={organizationName}
              />
            }
          >
            <Avatar className="size-5 rounded-md">
              <AvatarImage
                alt=""
                className="rounded-md"
                src={displayOrganization?.logo ?? undefined}
              />
              <AvatarFallback className="rounded-md text-xs">
                {orgMark(displayOrganization?.name)}
              </AvatarFallback>
            </Avatar>
            <span className="min-w-0 flex-1 truncate font-medium group-data-[collapsible=icon]:hidden">
              {organizationName}
            </span>
            <ChevronsUpDown className="ml-auto size-4 text-muted-foreground group-data-[collapsible=icon]:hidden" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="min-w-56 rounded-lg"
            side={menuSide}
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
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
      <SidebarMenuItem className="shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                className="size-8 justify-center p-0 group-data-[collapsible=icon]:p-1!"
                tooltip={user.name ?? "Account"}
              />
            }
          >
            <Avatar size="sm">
              <AvatarImage alt="" src={user.image ?? undefined} />
              <AvatarFallback>
                {user.name?.slice(0, 2).toUpperCase() ?? "??"}
              </AvatarFallback>
            </Avatar>
            <span className="sr-only">{user.name ?? "Account"}</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="min-w-56 rounded-lg"
            side={menuSide}
            sideOffset={4}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                  <Avatar className="h-8 w-8 rounded-lg">
                    <AvatarImage
                      alt={user.name ?? "User"}
                      src={user.image ?? undefined}
                    />
                    <AvatarFallback className="rounded-lg">
                      {user.name?.slice(0, 2).toUpperCase() ?? "??"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">
                      {user.name ?? "User"}
                    </span>
                    <span className="truncate text-xs">{user.email}</span>
                  </div>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <ThemeMenuItem />
            <DropdownMenuItem onClick={() => navigate({ to: "/settings" })}>
              <Settings />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut}>
              <LogOut className="mr-2 size-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
