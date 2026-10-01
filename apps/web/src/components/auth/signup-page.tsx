import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { authClient } from "@workspace/auth/client";
import { Button } from "@workspace/ui/components/shadcn/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/shadcn/card";
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
import { safeRedirectPath } from "@/lib/auth/safe-redirect";

interface SignUpValues {
  name: string;
  email: string;
  password: string;
}

// Better Auth's default minimum (dist/context/create-context.mjs:
// `minPasswordLength: options.emailAndPassword?.minPasswordLength || 8`).
const PASSWORD_MIN_LENGTH = 8;

export function SignUpPage() {
  const navigate = useNavigate();
  const { redirect: redirectTo } = useSearch({ from: "/_auth/signup" });

  const signupSchema = z.object({
    name: z.string({ message: "Name" }).min(2),
    email: z.email({ message: "Email" }),
    password: z
      .string({ message: "Password" })
      .min(PASSWORD_MIN_LENGTH)
      .max(100),
  });

  const form = useForm<SignUpValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { name: "", email: "", password: "" },
  });

  const onSubmit = async (values: SignUpValues) => {
    const { error } = await authClient.signUp.email({
      name: values.name,
      email: values.email,
      password: values.password,
    });

    if (error) {
      toast.error(error.message ?? "An error occurred");
    } else {
      toast.success("Account created successfully");
      // Honour `redirect` (e.g. an invitation link carried through from
      // login): a fresh full load re-establishes the session nanostores.
      const next = safeRedirectPath(redirectTo, "/onboarding");
      if (next !== "/onboarding") {
        window.location.assign(next);
        return;
      }
      await navigate({ to: "/onboarding" });
    }
  };

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Create an account</CardTitle>
        <CardDescription>Create an account to get started</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)}>
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
                    autoComplete="name"
                    id={field.name}
                    placeholder="John Doe"
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
            <Controller
              control={form.control}
              name="email"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>Email</FieldLabel>
                  <Input
                    {...field}
                    aria-invalid={fieldState.invalid}
                    autoComplete="email"
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
              name="password"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>Password</FieldLabel>
                  <Input
                    {...field}
                    aria-invalid={fieldState.invalid}
                    autoComplete="new-password"
                    id={field.name}
                    type="password"
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
            <Field>
              <Button disabled={form.formState.isSubmitting} type="submit">
                {form.formState.isSubmitting
                  ? "Creating account..."
                  : "Sign up"}
              </Button>
              <p className="text-center text-muted-foreground text-sm">
                Already have an account?{" "}
                <Link
                  className="underline-offset-4 hover:underline"
                  search={{ redirect: redirectTo }}
                  to="/login"
                >
                  Login
                </Link>
              </p>
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
