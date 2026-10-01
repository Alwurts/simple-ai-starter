import { type LucideIcon, Package, Settings } from "lucide-react";

export interface PlatformNavigationItem {
  title: string;
  url: string;
  icon: LucideIcon;
}

/** Single source for sidebar + ⌘K Pages group. Chats live in the Chats group. */
export function getPlatformNavigationItems(): PlatformNavigationItem[] {
  return [
    { title: "Catalog", url: "/catalog", icon: Package },
    { title: "Settings", url: "/settings", icon: Settings },
  ];
}

/** Items stay active on nested paths (e.g. /settings/*). */
export function isPlatformNavActive(pathname: string, url: string): boolean {
  return pathname === url || pathname.startsWith(`${url}/`);
}
