import { getOrganizationSummary } from "@workspace/core/organization";
import { buildOrgHeader } from "./system-prompt";

export async function buildOrgContext(organizationId: string) {
  const org = await getOrganizationSummary(organizationId);

  if (!org) {
    throw new Error(
      `OrgAgent ${organizationId}: organization not found in D1 mid-conversation.`
    );
  }

  return { header: buildOrgHeader(org) };
}
