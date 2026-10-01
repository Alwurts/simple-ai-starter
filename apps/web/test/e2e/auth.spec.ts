import { expect, test } from "@playwright/test";
import { fillValue, waitForRouteSettled, waitHydrated } from "./helpers";

const LOGIN_URL_PATTERN = /login/;
const ONBOARDING_URL_PATTERN = /onboarding/;
// The chat is the signed-in home; a fresh org lands on the new-chat draft.
const HOME_URL_PATTERN = /\/chat\/(new|[0-9a-f]+)/;
const LOGIN_REDIRECT_PATTERN = /login\?redirect=%2Faccept-invitation%2F/;
const SIGNUP_REDIRECT_PATTERN = /signup\?redirect=%2Faccept-invitation%2F/;

test.describe("auth guards", () => {
  test("unauthenticated user is redirected to login", async ({ page }) => {
    await page.goto("/catalog");
    await expect(page).toHaveURL(LOGIN_URL_PATTERN, { timeout: 10_000 });
  });

  test("unauthenticated user cannot access dashboard", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(LOGIN_URL_PATTERN, { timeout: 10_000 });
  });
});

test.describe("signup flow", () => {
  test("can sign up a new account", async ({ page }) => {
    const uniqueEmail = `signup-${Date.now()}@test.com`;

    await page.goto("/signup");
    await waitHydrated(page);
    await fillValue(page.locator("input#name"), "Signup Test User");
    await fillValue(page.locator("input#email"), uniqueEmail);
    await fillValue(page.locator("input#password"), "TestPassword123!");
    await page.getByRole("button", { name: "Sign up" }).click();

    await expect(page).toHaveURL(ONBOARDING_URL_PATTERN, { timeout: 15_000 });
  });
});

test.describe("login flow", () => {
  const loginEmail = `login-${Date.now()}@test.com`;
  const loginPassword = "TestPassword123!";

  test("can log in with existing credentials", async ({ page }) => {
    // First, create a user via signup + onboarding
    await page.goto("/signup");
    await waitHydrated(page);
    await fillValue(page.locator("input#name"), "Login Test User");
    await fillValue(page.locator("input#email"), loginEmail);
    await fillValue(page.locator("input#password"), loginPassword);
    await page.getByRole("button", { name: "Sign up" }).click();
    await expect(page).toHaveURL(ONBOARDING_URL_PATTERN, { timeout: 15_000 });

    // Complete onboarding (org route chunks settle after the URL changes)
    await waitForRouteSettled(page);
    await fillValue(page.locator("input#name"), "Login Test Org");
    await page.getByRole("button", { name: "Create Organization" }).click();
    await expect(page).toHaveURL(HOME_URL_PATTERN, { timeout: 15_000 });

    // Now navigate to login page directly (fresh context without cookies)
    await page.context().clearCookies();
    await page.goto("/login");
    await waitHydrated(page);

    // Log in with the credentials
    await fillValue(page.locator("input#email"), loginEmail);
    await fillValue(page.locator("input#password"), loginPassword);
    await page.getByRole("button", { name: "Log in" }).click();

    await expect(page).toHaveURL(HOME_URL_PATTERN, { timeout: 15_000 });
  });
});

/** Sign up `email` and create an org, leaving the session signed in. */
async function signUpAndCreateOrg(
  page: import("@playwright/test").Page,
  { name, email, orgName }: { name: string; email: string; orgName: string }
) {
  await page.goto("/signup");
  await submitSignUp(page, email, name);
  await expect(page).toHaveURL(ONBOARDING_URL_PATTERN, { timeout: 15_000 });
  await waitForRouteSettled(page);
  await fillValue(page.locator("input#name"), orgName);
  await page.getByRole("button", { name: "Create Organization" }).click();
  await expect(page).toHaveURL(HOME_URL_PATTERN, { timeout: 15_000 });
}

/** Invite `email` from the members page; returns the invitation id. */
async function inviteMember(
  page: import("@playwright/test").Page,
  email: string
): Promise<string> {
  await page.goto("/settings/members");
  await waitHydrated(page);
  await fillValue(page.locator("input#email"), email);
  await page.getByRole("button", { name: "Send Invitation" }).click();
  await expect(page.getByText("Member invited successfully")).toBeVisible({
    timeout: 10_000,
  });
  const invitations = (await (
    await page.request.get("/api/auth/organization/list-invitations")
  ).json()) as Array<{ email: string; id: string }>;
  const invitation = invitations.find((candidate) => candidate.email === email);
  expect(invitation, `invitation for ${email} exists`).toBeTruthy();
  return invitation?.id ?? "";
}

/** Fill and submit the signup form on the already-open signup page. */
async function submitSignUp(
  page: import("@playwright/test").Page,
  email: string,
  name = "E2E Invited User"
) {
  await waitHydrated(page);
  await fillValue(page.locator("input#name"), name);
  await fillValue(page.locator("input#email"), email);
  await fillValue(page.locator("input#password"), "TestPassword123!");
  await page.getByRole("button", { name: "Sign up" }).click();
}

test.describe("invitation for a brand-new user", () => {
  test("carries the invite through sign-up and lands in the org", async ({
    page,
  }) => {
    const ownerEmail = `invite-owner-${Date.now()}@test.com`;
    const inviteeEmail = `invite-new-${Date.now()}@test.com`;

    await signUpAndCreateOrg(page, {
      name: "Invite Owner",
      email: ownerEmail,
      orgName: "Invite Org",
    });
    const invitationId = await inviteMember(page, inviteeEmail);

    // Open the invite link signed out: login keeps the redirect, and its
    // "Sign up" link carries it to signup (checkpoint A finding 1).
    await page.context().clearCookies();
    await page.goto(`/accept-invitation/${invitationId}`);
    await expect(page).toHaveURL(LOGIN_REDIRECT_PATTERN, {
      timeout: 10_000,
    });
    await waitHydrated(page);
    await page.getByRole("link", { name: "Sign up" }).click();
    await expect(page).toHaveURL(SIGNUP_REDIRECT_PATTERN, {
      timeout: 10_000,
    });

    // Sign-up on this page honours the redirect: straight to the invitation.
    await submitSignUp(page, inviteeEmail);
    await expect(page).toHaveURL(
      new RegExp(`accept-invitation/${invitationId}`),
      {
        timeout: 15_000,
      }
    );
    await waitHydrated(page);
    await page.getByRole("button", { name: "Accept invitation" }).click();

    // Accepting sets the org active and lands in the app.
    await expect(page).toHaveURL(HOME_URL_PATTERN, { timeout: 15_000 });
    await expect(page.getByText("Invite Org").first()).toBeVisible({
      timeout: 10_000,
    });
  });
});

test.describe("removed member", () => {
  // Checkpoint A finding 2: better-auth keeps the removed member's
  // `activeOrganizationId` on their *existing* session row, so the `_org`
  // guard must verify membership against the live member row.
  test("is sent to onboarding instead of the org shell", async ({
    browser,
    page,
  }) => {
    const ownerEmail = `remove-owner-${Date.now()}@test.com`;
    const inviteeEmail = `remove-member-${Date.now()}@test.com`;

    // The owner works in a separate context so the invitee's page below
    // keeps its own (soon stale) session throughout.
    const ownerContext = await browser.newContext();
    const ownerPage = await ownerContext.newPage();
    await signUpAndCreateOrg(ownerPage, {
      name: "Remove Owner",
      email: ownerEmail,
      orgName: "Removal Org",
    });
    const invitationId = await inviteMember(ownerPage, inviteeEmail);

    // The invitee signs up (no org), then accepts via the link — this page's
    // session now carries `activeOrganizationId` and is never replaced.
    await page.goto("/signup");
    await submitSignUp(page, inviteeEmail);
    await expect(page).toHaveURL(ONBOARDING_URL_PATTERN, { timeout: 15_000 });
    await page.goto(`/accept-invitation/${invitationId}`);
    await waitHydrated(page);
    await page.getByRole("button", { name: "Accept invitation" }).click();
    await expect(page).toHaveURL(HOME_URL_PATTERN, { timeout: 15_000 });

    // The owner removes the invitee from their own session.
    await ownerPage.goto("/settings/members");
    await waitHydrated(ownerPage);
    await ownerPage
      .getByRole("button", { name: "Remove", exact: true })
      .click();
    await ownerPage.getByRole("button", { name: "Remove member" }).click();
    await expect(
      ownerPage.getByText("Member removed successfully")
    ).toBeVisible({ timeout: 10_000 });
    await ownerContext.close();

    // The invitee's still-open session keeps the stale active org: navigating
    // to an org route must hit the guard's membership check and land on
    // onboarding — never the org shell with empty data.
    await page.goto("/catalog");
    await expect(page).toHaveURL(ONBOARDING_URL_PATTERN, { timeout: 15_000 });
  });
});
