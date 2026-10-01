"use client";

import { useSidebar } from "@workspace/ui/components/shadcn/sidebar";

/** The mobile sidebar is a sheet; navigating must dismiss it. */
export function useCloseMobileSidebarOnNavigate() {
  const { isMobile, setOpenMobile } = useSidebar();
  return () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };
}
