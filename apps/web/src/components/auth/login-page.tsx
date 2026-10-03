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

interface LoginValues {
  email: string;
  password: string;
}

export function LoginPage() {
  const navigate = useNavigate();
  const { redirect: redirectTo } = useSearch({ from: "/_auth/login" });

  const loginSchema = z.object({
    email: z.email({ message: "Enter a valid email address." }),
    password: z
      .string({ message: "Enter your password." })
      .min(6, { message: "Password must be at least 6 characters." }),
  });

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (values: LoginValues) => {
    const result = await authClient.signIn.email({
      email: values.email,
      password: values.password,
    });

    if (result.error) {
      toast.error(result.error.message ?? "An error occurred");
    } else {
      toast.success("Login successful");
      await Promise.all([
        authClient.getSession(),
        authClient.organization.list(),
        authClient.organization.getFullOrganization().catch(() => undefined),
      ]);
      const next = safeRedirectPath(redirectTo);
      if (next !== "/") {
        window.location.assign(next);
        return;
      }
      await navigate({ to: "/" });
    }
  };

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Login to your account</CardTitle>
        <CardDescription>
          Enter your email below to login to your account
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form method="post" onSubmit={form.handleSubmit(onSubmit)}>
          <FieldGroup>
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
                    autoComplete="current-password"
                    id={field.name}
                    type="password"
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                  <Link
                    className="text-sm underline-offset-4 hover:underline"
                    to="/forgot-password"
                  >
                    Forgot your password?
                  </Link>
                </Field>
              )}
            />
            <Field>
              <Button disabled={form.formState.isSubmitting} type="submit">
                {form.formState.isSubmitting ? "Logging in..." : "Log in"}
              </Button>
              <p className="text-center text-muted-foreground text-sm">
                Don't have an account?{" "}
                <Link
                  className="underline-offset-4 hover:underline"
                  search={{ redirect: redirectTo }}
                  to="/signup"
                >
                  Sign up
                </Link>
              </p>
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
