import { LogoMark } from "@workspace/ui/components/brand/logo-monochrome";
import { cn } from "@workspace/ui/lib/utils";
import type { ReactNode } from "react";

/** The app name as shown on auth surfaces — swap with the logo on rebrand. */
export const APP_NAME = "Starter";

/**
 * The shared auth/onboarding chrome: muted backdrop, brand mark + app name,
 * card slot. Every signed-out surface (login, signup, onboarding) renders
 * through this so they share one look.
 */
export function AuthPage({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative flex min-h-screen flex-col items-center justify-center gap-8 bg-muted p-4",
        className
      )}
    >
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <LogoMark className="size-6" />
        </div>
        <span className="font-semibold text-xl">{APP_NAME}</span>
      </div>
      {children}
    </div>
  );
}
