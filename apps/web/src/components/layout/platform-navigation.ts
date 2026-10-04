import { type LucideIcon, Package, Settings, Users } from "lucide-react";

export interface PlatformNavigationItem {
  title: string;
  url: string;
  icon: LucideIcon;
}

/** Sidebar destinations. Settings lives in the sidebar footer. */
export function getPlatformNavigationItems(): PlatformNavigationItem[] {
  return [{ title: "Catalog", url: "/catalog", icon: Package }];
}

/** ⌘K pages. Members is a section of Settings, not a sidebar item. */
export function getPalettePages(): PlatformNavigationItem[] {
  return [
    ...getPlatformNavigationItems(),
    { title: "Settings", url: "/settings/general", icon: Settings },
    { title: "Members", url: "/settings/members", icon: Users },
  ];
}

export function isPlatformNavActive(pathname: string, url: string): boolean {
  return pathname === url || pathname.startsWith(`${url}/`);
}
