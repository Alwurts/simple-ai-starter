# Agent tool approvals

Product writes use one approval shape. The authoring detail (the
`needsApproval` rule, per-tool-class guidance, and how to add gated writes
such as `update_product` / `delete_product`) lives in
**[writing-agent-tools.md](./writing-agent-tools.md)**.

## Top-level tools

`needsApproval: true` on a top-level tool pauses before `execute` with part
state `approval-requested`. The chat renders Approve/Reject
(`apps/web/src/components/chat/messages/chat-message-row.tsx`). Approve and
Reject call `addToolApprovalResponse` from `useAgentChat`
(`apps/web/src/components/chat/chat-page.tsx`). The agents client sends that
as a tool-approval frame and continues the turn.

Code cannot call product tools. `exec` is not an approval gate. `update_product`
and `delete_product` still ask for approval when the model calls them.

A tool runs as the user of the connection that sent the turn or the approval
frame. `OrgChat.getTools()` binds that user per invocation. A live connection
at execute time wins over the user bound when the tools were built. If neither
is present, the write fails closed with the permission-denied result.
