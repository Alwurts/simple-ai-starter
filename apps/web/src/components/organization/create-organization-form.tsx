"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "@tanstack/react-router";
import { authClient } from "@workspace/auth/client";
import { Button } from "@workspace/ui/components/shadcn/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@workspace/ui/components/shadcn/field";
import { Input } from "@workspace/ui/components/shadcn/input";
import { toast } from "@workspace/ui/components/shadcn/sonner";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import {
  filterName,
  filterSlug,
  organizationSlugSchema,
  slugFromName,
} from "@/lib/organization/organization-form";

const createOrganizationSchema = z.object({
  name: z
    .string()
    .min(3, { message: "Name must be at least 3 characters" })
    .max(100, { message: "Name must be less than 100 characters" }),
  slug: organizationSlugSchema,
});

export type CreateOrganizationData = z.infer<typeof createOrganizationSchema>;

export function CreateOrganizationForm({
  className,
  onSuccess,
}: {
  className?: string;
  onSuccess?: () => void;
}) {
  const navigate = useNavigate();

  const form = useForm<CreateOrganizationData>({
    resolver: zodResolver(createOrganizationSchema),
    defaultValues: {
      name: "",
      slug: "",
    },
  });

  async function onSubmit(values: CreateOrganizationData) {
    try {
      const { data: slugCheck, error: slugError } =
        await authClient.organization.checkSlug({ slug: values.slug });

      if (slugError) {
        toast.error(slugError.message ?? "Failed to create organization");
        return;
      }

      if (!slugCheck?.status) {
        toast.error("Slug already exists");
        return;
      }

      const { data, error } = await authClient.organization.create({
        name: values.name,
        slug: values.slug,
      });

      if (data) {
        await authClient.organization.setActive({
          organizationId: data.id,
        });
        navigate({ to: "/" });
        if (onSuccess) {
          onSuccess();
        }
      } else {
        toast.error(error?.message ?? "Failed to create organization");
      }
    } catch {
      toast.error("Failed to create organization");
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
                id={field.name}
                onChange={(e) => {
                  const filtered = filterName(e.target.value);
                  field.onChange(filtered);
                  form.setValue("slug", slugFromName(filtered));
                }}
                placeholder="SpaceX"
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
                id={field.name}
                onChange={(e) => {
                  const filtered = filterSlug(e.target.value);
                  field.onChange(filtered);
                }}
                placeholder="spacex"
                type="text"
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Field>
          <Button
            className="w-full"
            disabled={form.formState.isSubmitting}
            type="submit"
          >
            {form.formState.isSubmitting
              ? "Creating..."
              : "Create Organization"}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  );
}
