# Agent tool approvals (moved)

Approval-gated writes and the full tool authoring guide now live in
**[writing-agent-tools.md](./writing-agent-tools.md)**.

That doc covers `needsApproval` ↔ AI SDK tool approval, the per-tool-class
rule (autonomous / approval / no tool), and how to add gated writes such as
`update_product` / `delete_product`.

The Approve/Reject UI lives in the chat page
(`apps/web/src/features/assistant/components/chat-message-parts.tsx`).
Approve and Reject call `addToolApprovalResponse` from `useAgentChat`
(`apps/web/src/features/assistant/components/full-screen-chat.tsx`). The
agents client sends that as a tool-approval frame and continues the turn;
the previous chat did not set `sendAutomaticallyWhen`.
