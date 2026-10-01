"use client";

import { Link, useRouterState } from "@tanstack/react-router";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@workspace/ui/components/shadcn/sidebar";
import { MessageSquarePlusIcon, Search } from "lucide-react";
import { useState } from "react";
import { SidebarChats } from "@/components/chat/sidebar-chats";
import { AppSidebarFooter } from "@/components/layout/app-sidebar-footer";
import {
  getPlatformNavigationItems,
  isPlatformNavActive,
} from "@/components/layout/platform-navigation";
import { OrgSwitcher } from "@/components/organization/org-switcher";
import { SearchCommand } from "@/components/search/search-command";

export function AppSidebar() {
  const [searchOpen, setSearchOpen] = useState(false);
  const closeOnNavigate = useCloseMobileSidebarOnNavigate();
  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader>
        <OrgSwitcher />
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => setSearchOpen(true)}
              tooltip="Search"
            >
              <Search />
              <span>Search</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent className="overflow-x-hidden">
        <SidebarGroup>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                render={<Link onClick={closeOnNavigate} to="/chat/new" />}
                tooltip="New chat"
                variant="outline"
              >
                <MessageSquarePlusIcon />
                <span>New chat</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
        <AppSidebarMainNavigation />
        <SidebarChats />
      </SidebarContent>
      <SidebarFooter>
        <AppSidebarFooter />
      </SidebarFooter>

      {/* Expanded desktop uses the rail; collapsed desktop uses the header trigger. */}
      <SidebarRail className="group-data-[collapsible=icon]:hidden" />
      <SearchCommand open={searchOpen} setOpen={setSearchOpen} />
    </Sidebar>
  );
}

/** The mobile sidebar is a sheet; navigating must dismiss it. */
export function useCloseMobileSidebarOnNavigate() {
  const { isMobile, setOpenMobile } = useSidebar();
  return () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };
}

function AppSidebarMainNavigation() {
  const closeOnNavigate = useCloseMobileSidebarOnNavigate();
  const pathname = useRouterState({
    select: (s) => s.location.pathname,
  });
  const items = getPlatformNavigationItems();
  return (
    <SidebarGroup>
      <SidebarGroupLabel>Platform</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => {
          const isActive = isPlatformNavActive(pathname, item.url);
          return (
            <SidebarMenuItem key={`${item.url}`}>
              <SidebarMenuButton
                isActive={isActive}
                render={<Link onClick={closeOnNavigate} to={item.url} />}
                tooltip={item.title}
              >
                <item.icon />
                <span>{item.title}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}
