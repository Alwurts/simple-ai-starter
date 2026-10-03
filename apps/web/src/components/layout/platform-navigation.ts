import { type LucideIcon, Package, Settings, Users } from "lucide-react";

export interface PlatformNavigationItem {
  title: string;
  url: string;
  icon: LucideIcon;
}

/** Single source for sidebar + ⌘K Pages group. Chats live in the Chats group. */
export function getPlatformNavigationItems(): PlatformNavigationItem[] {
  return [
    { title: "Catalog", url: "/catalog", icon: Package },
    { title: "General", url: "/settings/general", icon: Settings },
    { title: "Members", url: "/settings/members", icon: Users },
  ];
}

/** An item stays active on its own url and on paths nested under that url. */
export function isPlatformNavActive(pathname: string, url: string): boolean {
  return pathname === url || pathname.startsWith(`${url}/`);
}
