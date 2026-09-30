import { DomainError } from "@workspace/core/errors";
import { errorMessage, structuredLog } from "@workspace/log";
import type { Context, TypedResponse } from "hono";
import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { toDotPath } from "zod/v4/core";

/** The code on every non-2xx body the API returns: `{ error: { code, message } }`. */
export type ApiErrorCode =
  | "validation"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "unprocessable"
  | "internal_error";

export interface ApiErrorIssue {
  path: string;
  message: string;
}

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: string;
    issues?: ApiErrorIssue[];
  };
}

const STATUS_BY_CODE: Record<ApiErrorCode, ContentfulStatusCode> = {
  validation: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  unprocessable: 422,
  internal_error: 500,
};

/** HTTPExceptions carry a status, not a code (the guards throw 401/403). */
const CODE_BY_STATUS: Partial<Record<number, ApiErrorCode>> = {
  400: "validation",
  401: "unauthorized",
  403: "forbidden",
  404: "not_found",
  409: "conflict",
  422: "unprocessable",
};

function errorResponse(
  c: Context,
  code: ApiErrorCode,
  message: string,
  issues?: ApiErrorIssue[]
): Response {
  const body: ApiErrorBody = issues
    ? { error: { code, message, issues } }
    : { error: { code, message } };
  return c.json(body, STATUS_BY_CODE[code]);
}

/**
 * zValidator hook: schema failures become the one error body — `code:
 * "validation"`, a readable first-issue message, and the full issue list.
 */
export function validationErrorHook(
  result:
    | { success: true }
    | {
        success: false;
        error: {
          issues: readonly { path: readonly PropertyKey[]; message: string }[];
        };
      },
  c: Context
): TypedResponse<ApiErrorBody, 400, "json"> | undefined {
  if (result.success) {
    return;
  }
  const issues: ApiErrorIssue[] = result.error.issues.map((issue) => ({
    path: toDotPath(issue.path),
    message: issue.message,
  }));
  const first = issues[0];
  let message = "Invalid request";
  if (first) {
    message = first.path ? `${first.path}: ${first.message}` : first.message;
  }
  return c.json({ error: { code: "validation", message, issues } }, 400);
}

/**
 * Unknown API routes. Registered both as `notFound` and as a trailing
 * `.all("*")` handler: `route()` merging drops a sub-app's notFound handler,
 * so the catch-all is what actually answers once the app is mounted under
 * `/api` (the parent's own catch-all must not win).
 */
export function apiNotFound(c: Context): Response {
  return errorResponse(c, "not_found", "Route not found");
}

/**
 * The app's single error handler: framework HTTP errors, `core`
 * {@link DomainError}s and validation failures all map to the one error body;
 * anything else is an unexpected failure, logged and returned as a generic
 * 500. Registered once on the root app (`app.onError`).
 */
export function appErrorHandler(err: Error, c: Context): Response {
  if (err instanceof HTTPException) {
    return errorResponse(
      c,
      CODE_BY_STATUS[err.status] ?? "internal_error",
      err.message
    );
  }
  if (err instanceof DomainError) {
    return errorResponse(c, err.code, err.message);
  }
  structuredLog({
    kind: "unhandled_error",
    severity: "error",
    error: errorMessage(err),
  });
  return errorResponse(c, "internal_error", "Internal server error");
}
