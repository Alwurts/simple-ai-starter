import { cn } from "@workspace/ui/lib/utils";
import type { ReactNode } from "react";

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
        "relative flex min-h-screen items-center justify-center bg-muted p-4",
        className
      )}
    >
      {children}
    </div>
  );
}
