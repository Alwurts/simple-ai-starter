import type { ErrorComponentProps } from "@tanstack/react-router";
import { useRouter } from "@tanstack/react-router";
import { Button } from "@workspace/ui/components/shadcn/button";
import { AlertCircle } from "lucide-react";

/**
 * Route error view, standalone by design: router `errorComponent`s mount
 * above the layout tree, outside `<OrgConnection>` — so no org-connected
 * part (the sidebar) may render here, or the error page itself crashes (B4).
 * Also used as the root `errorComponent`.
 */
export function RouteError({ error, reset }: ErrorComponentProps) {
  const router = useRouter();

  return (
    <div className="flex h-svh flex-col items-center justify-center gap-4 p-6">
      <AlertCircle className="h-12 w-12 text-destructive" />
      <h2 className="font-semibold text-xl">Something went wrong</h2>
      <p className="max-w-md text-center text-muted-foreground">
        {error instanceof Error
          ? error.message
          : "An unexpected error occurred"}
      </p>
      <div className="flex gap-2">
        <Button onClick={() => reset()} variant="outline">
          Try Again
        </Button>
        <Button onClick={() => router.navigate({ to: "/" })}>Go Home</Button>
      </div>
    </div>
  );
}
