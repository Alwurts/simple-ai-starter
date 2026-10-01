"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { can } from "@workspace/auth/access-control";
import { authClient } from "@workspace/auth/client";
import { Button } from "@workspace/ui/components/shadcn/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@workspace/ui/components/shadcn/field";
import { Input } from "@workspace/ui/components/shadcn/input";
import { toast } from "@workspace/ui/components/shadcn/sonner";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { useUpdateOrganization } from "@/hooks/organization/use-organization";
import { organizationSlugSchema } from "@/lib/organization/organization-form";

function organizationDetailsSchema() {
  return z.object({
    name: z
      .string()
      .min(2, { message: "Name must be at least 2 characters" })
      .max(100, { message: "Name must be less than 100 characters" }),
    slug: organizationSlugSchema,
  });
}

type OrganizationDetailsData = z.infer<
  ReturnType<typeof organizationDetailsSchema>
>;

interface OrganizationDetailsFormProps {
  organization: {
    id: string;
    name: string;
    slug: string;
  };
  className?: string;
}

export function OrganizationDetailsForm({
  organization,
  className,
}: OrganizationDetailsFormProps) {
  const updateOrganization = useUpdateOrganization();
  const { data: activeMember } = authClient.useActiveMember();
  // Editing org settings is admin+; members see the values read-only.
  const canEditSettings = can("org:settings", {
    role: activeMember?.role ?? null,
  });

  const form = useForm<OrganizationDetailsData>({
    resolver: zodResolver(organizationDetailsSchema()),
    defaultValues: {
      name: organization.name,
      slug: organization.slug,
    },
  });

  async function onSubmit(values: OrganizationDetailsData) {
    try {
      await updateOrganization.mutateAsync(values);
      toast.success("Organization details updated successfully");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update organization"
      );
    }
  }

  return (
    <form className={className} onSubmit={form.handleSubmit(onSubmit)}>
      <FieldGroup>
        <Controller
          control={form.control}
          name="name"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>Name</FieldLabel>
              <Input
                {...field}
                aria-invalid={fieldState.invalid}
                disabled={!canEditSettings}
                id={field.name}
                placeholder="My company"
                type="text"
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="slug"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>Slug</FieldLabel>
              <Input
                {...field}
                aria-invalid={fieldState.invalid}
                disabled={!canEditSettings}
                id={field.name}
                placeholder="my-company"
                type="text"
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Field>
          <Button
            disabled={!canEditSettings || updateOrganization.isPending}
            type="submit"
          >
            {updateOrganization.isPending ? "Saving..." : "Save Changes"}
          </Button>
          {!canEditSettings && (
            <FieldDescription>
              Only administrators can edit organization details.
            </FieldDescription>
          )}
        </Field>
      </FieldGroup>
    </form>
  );
}
