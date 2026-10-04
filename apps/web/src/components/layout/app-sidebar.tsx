"use client";

import { Link, useRouterState } from "@tanstack/react-router";
import { LogoMark } from "@workspace/ui/components/brand/logo-monochrome";
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
} from "@workspace/ui/components/shadcn/sidebar";
import { Search } from "lucide-react";
import { useState } from "react";
import { SidebarChats } from "@/components/chat/sidebar-chats";
import { AppSidebarFooter } from "@/components/layout/app-sidebar-footer";
import {
  getPlatformNavigationItems,
  isPlatformNavActive,
} from "@/components/layout/platform-navigation";
import { SearchCommand } from "@/components/search/search-command";
import { useCloseMobileSidebarOnNavigate } from "@/hooks/layout/use-close-mobile-sidebar-on-navigate";

export function AppSidebar() {
  const [searchOpen, setSearchOpen] = useState(false);
  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem className="flex items-center gap-2">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <LogoMark className="size-5" />
            </div>
            <SidebarMenuButton
              className="ml-auto size-8 group-data-[collapsible=icon]:hidden"
              onClick={() => setSearchOpen(true)}
              tooltip="Search"
            >
              <Search />
              <span className="sr-only">Search</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <SidebarMenu className="hidden group-data-[collapsible=icon]:flex">
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
        <AppSidebarMainNavigation />
        <SidebarChats />
      </SidebarContent>
      <SidebarFooter>
        <AppSidebarFooter />
      </SidebarFooter>

      <SidebarRail className="group-data-[collapsible=icon]:hidden" />
      <SearchCommand open={searchOpen} setOpen={setSearchOpen} />
    </Sidebar>
  );
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
