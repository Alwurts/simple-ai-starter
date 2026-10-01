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
  DropdownMenuItem,
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
import { AlertCircle, ChevronsUpDown, LogOut, Settings } from "lucide-react";
import { ThemeMenuItem } from "@/components/common/theme-toggle";

function SidebarFooterSkeleton() {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton aria-label="Loading user" disabled size="lg">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <div className="grid flex-1 text-left text-sm leading-tight">
            <Skeleton className="mb-1 h-4 w-24" />
            <Skeleton className="h-3 w-32" />
          </div>
          <ChevronsUpDown className="ml-auto size-4" />
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

function SidebarFooterError() {
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
 * The sidebar footer's nav-user (shadcn pattern): the signed-in user's
 * avatar, name and email, with the theme toggle, Settings and Sign out in
 * the menu. The org switch lives in the header's `OrgSwitcher`.
 */
export function AppSidebarFooter() {
  const { isMobile } = useSidebar();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: session, isPending, error } = authClient.useSession();
  const user = session?.user;

  const handleSignOut = async () => {
    await authClient.signOut();
    // The next session may be a different user/org — never serve this
    // session's cache (B5).
    queryClient.clear();
    navigate({
      to: "/login",
    });
  };

  if (isPending) {
    return <SidebarFooterSkeleton />;
  }
  if (error || !user) {
    return <SidebarFooterError />;
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                size="lg"
                tooltip={user.name ?? "Account"}
              />
            }
          >
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
              <span className="truncate text-muted-foreground text-xs">
                {user.email}
              </span>
            </div>
            <ChevronsUpDown className="ml-auto size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
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
