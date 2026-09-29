import { getOrgAgentTools } from "@workspace/agent";
import { describe, expect, it } from "vitest";

/**
 * ALW-348 / ALW-456 / ALW-524 / ALW-740 — human-approval-gated agent writes.
 *
 * Product tools are top-level Think tools. `needsApproval: true` uses the AI SDK
 * approval pause (`approval-requested` → DefaultTool Approve/Reject via
 * `addToolApprovalResponse`).
 *
 * The live end-to-end (model calls the tool → chat renders Approve/Reject →
 * resume) needs a real facet + model and is verified in `pnpm dev` — see
 * org-agent.workerd.test.ts for why the harness can't drive it.
 */

const ctx = {
  organizationId: "org_test",
  userId: "user_test",
  waitUntil: () => undefined,
};

describe("top-level approval-gated writes (ALW-456 / ALW-740)", () => {
  it("update_product and delete_product are gated with needsApproval", () => {
    const tools = getOrgAgentTools(ctx);
    for (const name of ["update_product", "delete_product"] as const) {
      expect(tools).toHaveProperty(name);
      expect((tools[name] as { needsApproval?: unknown }).needsApproval).toBe(
        true
      );
    }
    // The autonomous catalog write stays ungated.
    expect(tools).toHaveProperty("create_product");
    expect(
      (tools.create_product as { needsApproval?: unknown }).needsApproval
    ).toBeUndefined();
  });

  it("org tools are exactly the five product tools", () => {
    const tools = getOrgAgentTools(ctx);
    expect(Object.keys(tools).sort()).toEqual([
      "create_product",
      "delete_product",
      "get_product",
      "list_products",
      "update_product",
    ]);
  });
});
