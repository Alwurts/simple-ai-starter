# Agent tool approvals

Approvals come in two shapes in this starter. The authoring detail (the
`needsApproval` ↔ AI SDK approval rule, per-tool-class guidance, and how to add
gated writes such as `update_product` / `delete_product`) lives in
**[writing-agent-tools.md](./writing-agent-tools.md)**.

## 1. Plain top-level tools — AI SDK approval pause

`needsApproval: true` on a top-level tool pauses before `execute` with part
state `approval-requested`. The chat renders Approve/Reject
(`apps/web/src/features/assistant/components/chat-message-parts.tsx` →
`addToolApprovalResponse`); Approve and Reject call `addToolApprovalResponse`
from `useAgentChat`
(`apps/web/src/features/assistant/components/full-screen-chat.tsx`). The
agents client sends that as a tool-approval frame and continues the turn.

## 2. Codemode (`execute` tool) — approval at the gated tool call

The `execute` tool itself is **not** approval-gated: read-only sandbox
code (list/get, workspace reads, data munging) runs freely — the sandbox has
no network and only the org's own tools. The approval lives where the side
effect is: a sandbox call to `update_product` / `delete_product` does not run
immediately — the codemode runtime pauses the run durably and the tool returns
`{ status: "paused", executionId, pending }` (a *truncated* preview). Think
exposes three client callables on `OrgChat` to resolve it:

- `pendingExecutions(executionId)` — the **full** args (the transcript copy
  is ~2 KB-bounded); the approval card fetches these before enabling
  Approve.
- `approveExecution(executionId)` — replays the run up to the paused call,
  executes it, and auto-continues the chat; the outcome replaces the paused
  tool output in the transcript.
- `rejectExecution(executionId, reason?)` — ends the run with
  `{ status: "rejected", reason }` so the model can adapt.

The paused card lives outside the collapsed Worked group
(`isPausedExecutionPart` / `PausedExecutionCard` in
`chat-message-parts.tsx`); a completed/errored run folds back in and renders
the code (as a code block) plus its result, logs, or error. One execution can
pause more than once (a loop that hits both gated tools): the card remounts
per pause (keyed by `executionId` + pending `seq`) so a second pause never
shows the first pause's args.

Identity note: a tool always runs as the user of the connection that sent the
turn or the approval frame (see `OrgChat.requireTurnUserId`); a model-initiated
continuation turn has no connection, so it runs no write tool — it fails closed
with the permission-denied result until a fresh user turn (or approval) stamps
an identity, which is the price of never guessing "some live connection".
