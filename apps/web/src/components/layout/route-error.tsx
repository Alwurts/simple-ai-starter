import type { ErrorComponentProps } from "@tanstack/react-router";
import { useRouter } from "@tanstack/react-router";
import { Shell, ShellInset } from "@workspace/ui/components/brand/shell";
import { Button } from "@workspace/ui/components/shadcn/button";
import { AlertCircle } from "lucide-react";
import { AppSidebar } from "./app-sidebar";

export function RouteError({ error, reset }: ErrorComponentProps) {
  const router = useRouter();

  return (
    <Shell sidebar={<AppSidebar />}>
      <ShellInset>
        <div className="flex h-full flex-col items-center justify-center gap-4 p-6">
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
            <Button onClick={() => router.navigate({ to: "/" })}>
              Go Home
            </Button>
          </div>
        </div>
      </ShellInset>
    </Shell>
  );
}
