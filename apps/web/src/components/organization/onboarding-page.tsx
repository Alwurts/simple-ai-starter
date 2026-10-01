"use client";

import { AuthPage } from "@workspace/ui/components/brand/auth-page";
import { CreateOrganizationForm } from "@/components/organization/create-organization-form";

export function OnboardingPage() {
  return (
    <AuthPage>
      <div className="w-full max-w-md space-y-8">
        <div className="space-y-2 text-center">
          <h1 className="font-bold text-3xl">Welcome</h1>
          <p className="text-lg text-muted-foreground">
            Let's create your organization to get started
          </p>
        </div>

        <div className="space-y-6">
          <CreateOrganizationForm className="space-y-6" />
        </div>

        <div className="text-center text-muted-foreground text-sm">
          <p>
            You can invite team members and manage settings after creating your
            organization.
          </p>
        </div>
      </div>
    </AuthPage>
  );
}
