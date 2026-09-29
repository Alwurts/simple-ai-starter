"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { productFormSchema } from "@workspace/contract/catalog";
import { Button } from "@workspace/ui/components/shadcn/button";
import {
  Field,
  FieldContent,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@workspace/ui/components/shadcn/field";
import { Input } from "@workspace/ui/components/shadcn/input";
import { Textarea } from "@workspace/ui/components/shadcn/textarea";
import {
  DEFAULT_CURRENCY,
  formatMajorInputValue,
} from "@workspace/ui/lib/money";
import { Controller, useForm } from "react-hook-form";
import type { z } from "zod";

export type ProductFormValues = z.infer<typeof productFormSchema>;

interface ProductFormProps {
  mode?: "create" | "edit";
  defaultValues?: Partial<ProductFormValues>;
  onSubmit: (data: ProductFormValues) => void;
  isLoading?: boolean;
  submitLabel?: string;
}

export function ProductForm({
  mode = "create",
  defaultValues,
  onSubmit,
  isLoading,
  submitLabel = mode === "create" ? "Add Product" : "Save Changes",
}: ProductFormProps) {
  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: defaultValues?.name ?? "",
      price: defaultValues?.price ?? 0,
      description: defaultValues?.description ?? null,
    },
  });

  const { isDirty } = form.formState;
  const submitDisabled = Boolean(isLoading) || (mode === "edit" && !isDirty);

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <FieldGroup className="gap-4">
        <Controller
          control={form.control}
          name="name"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel
                className="text-muted-foreground"
                htmlFor={field.name}
              >
                Name
              </FieldLabel>
              <FieldContent>
                <Input
                  {...field}
                  aria-invalid={fieldState.invalid}
                  id={field.name}
                  placeholder="Product Name"
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </FieldContent>
            </Field>
          )}
        />

        <Controller
          control={form.control}
          name="price"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel
                className="text-muted-foreground"
                htmlFor={field.name}
              >
                Price
              </FieldLabel>
              <FieldContent>
                <Input
                  {...field}
                  aria-invalid={fieldState.invalid}
                  id={field.name}
                  onChange={(e) =>
                    field.onChange(Number.parseFloat(e.target.value))
                  }
                  step="0.01"
                  type="number"
                  value={formatMajorInputValue(field.value, DEFAULT_CURRENCY)}
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </FieldContent>
            </Field>
          )}
        />

        <Controller
          control={form.control}
          name="description"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel
                className="text-muted-foreground"
                htmlFor={field.name}
              >
                Description
              </FieldLabel>
              <FieldContent>
                <Textarea
                  {...field}
                  aria-invalid={fieldState.invalid}
                  className="resize-none"
                  id={field.name}
                  placeholder="Product details..."
                  value={field.value ?? ""}
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </FieldContent>
            </Field>
          )}
        />

        <div className="flex justify-end pt-1">
          <Button disabled={submitDisabled} type="submit">
            {isLoading ? "Saving..." : submitLabel}
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}
