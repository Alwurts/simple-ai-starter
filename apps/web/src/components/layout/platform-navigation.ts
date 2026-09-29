import {
  type LucideIcon,
  MessageSquare,
  Package,
  Settings,
} from "lucide-react";

export interface PlatformNavigationItem {
  title: string;
  url: string;
  icon: LucideIcon;
}

/** Single source for sidebar + ⌘K Pages group. */
export function getPlatformNavigationItems(): PlatformNavigationItem[] {
  return [
    { title: "Chat", url: "/", icon: MessageSquare },
    { title: "Catalog", url: "/catalog", icon: Package },
    { title: "Settings", url: "/settings", icon: Settings },
  ];
}

/** Chat covers `/` and every `/chat/*` thread; other items stay active on nested paths (e.g. /settings/*). */
export function isPlatformNavActive(pathname: string, url: string): boolean {
  if (url === "/") {
    return pathname === "/" || pathname.startsWith("/chat/");
  }
  return pathname === url || pathname.startsWith(`${url}/`);
}
