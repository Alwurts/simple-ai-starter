import { resolveOrgChatCapabilities } from "@workspace/agent/inference";
import { Hono } from "hono";
import type { HonoContextWithAuth } from "../types";

/**
 * Expose the active org-chat model's input capabilities so the composer can
 * gate attachments before send. Env-driven — same resolution as the
 * Durable Object model pick; no secrets returned.
 */
export const chatRoutes = new Hono<HonoContextWithAuth>().get(
  "/capabilities",
  (c) => {
    const capabilities = resolveOrgChatCapabilities(c.env);
    return c.json(capabilities);
  }
);
