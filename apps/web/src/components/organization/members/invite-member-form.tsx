"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { can, type RoleName } from "@workspace/auth/access-control";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/shadcn/select";
import { toast } from "@workspace/ui/components/shadcn/sonner";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { useInviteMember } from "@/hooks/organization/use-organization";
import { roleMessage } from "@/lib/organization/role-label";

interface InviteMemberData {
  email: string;
  role: "member" | "admin" | "owner";
}

interface InviteMemberFormProps {
  className?: string;
  onSuccess?: () => void;
}

export function InviteMemberForm({
  className,
  onSuccess,
}: InviteMemberFormProps) {
  const inviteMember = useInviteMember();
  const { data: activeMember } = authClient.useActiveMember();
  const currentRole = activeMember?.role ?? null;

  // RBAC seam: member management is admin+. Operators see an honest, explained
  // disabled state rather than a control that silently 403s on submit.
  const canManageMembers = can("member:manage", { role: currentRole });
  // Handing out the owner role is owner-only; admins invite admin/member.
  const canInviteOwner = can("member:invite-owner", { role: currentRole });

  const formSchema = z.object({
    email: z.string().email({ message: "Invalid email address" }),
    role: z.enum(["member", "admin", "owner"]),
  });

  const form = useForm<InviteMemberData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      role: "member",
    },
  });

  if (!canManageMembers) {
    return (
      <FieldGroup className={className}>
        <Field>
          <FieldLabel>Invite member</FieldLabel>
          <FieldDescription>
            Only administrators can invite or manage members.
          </FieldDescription>
        </Field>
      </FieldGroup>
    );
  }

  async function onSubmit(values: InviteMemberData) {
    // Defense in depth: the server enforces this too; this keeps the UI honest.
    if (values.role === "owner" && !canInviteOwner) {
      toast.error(
        `As ${roleMessage(currentRole as RoleName)}, you can't invite an ${roleMessage("owner")}`
      );
      return;
    }

    try {
      await inviteMember.mutateAsync(values);
      toast.success("Member invited successfully");
      form.reset();
      onSuccess?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to invite member"
      );
    }
  }

  return (
    <form className={className} onSubmit={form.handleSubmit(onSubmit)}>
      <FieldGroup>
        <div className="flex flex-col gap-4 sm:flex-row sm:gap-2">
          <Controller
            control={form.control}
            name="email"
            render={({ field, fieldState }) => (
              <Field
                className="min-w-0 flex-1"
                data-invalid={fieldState.invalid}
              >
                <FieldLabel htmlFor={field.name}>Email</FieldLabel>
                <Input
                  {...field}
                  aria-invalid={fieldState.invalid}
                  id={field.name}
                  placeholder="m@example.com"
                  type="email"
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />
          <Controller
            control={form.control}
            name="role"
            render={({ field, fieldState }) => (
              <Field
                className="w-full sm:w-40 sm:shrink-0"
                data-invalid={fieldState.invalid}
              >
                <FieldLabel htmlFor={field.name}>Role</FieldLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger className="w-full" id={field.name}>
                    <SelectValue placeholder="Select role">
                      {roleMessage(field.value as RoleName)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {canInviteOwner && (
                      <SelectItem value="owner">Owner</SelectItem>
                    )}
                    <SelectItem value="admin">Administrator</SelectItem>
                    <SelectItem value="member">Operator</SelectItem>
                  </SelectContent>
                </Select>
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />
        </div>
        <Field>
          <Button
            className="w-full"
            disabled={inviteMember.isPending}
            type="submit"
          >
            {inviteMember.isPending ? "Inviting..." : "Send Invitation"}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  );
}
