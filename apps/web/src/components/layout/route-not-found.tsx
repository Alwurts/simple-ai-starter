import { Link } from "@tanstack/react-router";
import { Button } from "@workspace/ui/components/shadcn/button";

/** Root `notFoundComponent` — standalone, like `RouteError`. */
export function RouteNotFound() {
  return (
    <div className="flex h-svh flex-col items-center justify-center gap-4 p-6">
      <h1 className="font-semibold text-xl">Page not found</h1>
      <p className="text-muted-foreground">
        The page you're looking for doesn't exist.
      </p>
      <Button render={<Link to="/" />}>Go Home</Button>
    </div>
  );
}
