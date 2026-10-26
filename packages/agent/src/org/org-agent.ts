import { Workspace, type WorkspaceStub } from "@cloudflare/computer";
import { WorkerJavaScriptBackend } from "@cloudflare/computer/backends/worker-javascript";
import { errorMessage, structuredLog } from "@workspace/log";
import { Agent, type Connection, callable } from "agents";
import type { UIMessage } from "ai";
import { WORKSPACE_CHANGE_FRAME, WORKSPACE_ROOT } from "../constants";
import type {
  ChatMessageHit,
  ChatSearchHit,
  ChatSummary,
  OrgAgentState,
  OrgMemorySnapshot,
  WorkspaceChangeFrame,
  WorkspaceFileInfo,
} from "../types";
import { OrgChat } from "./chat";
import {
  mergeChatSearchResults,
  SEARCH_MAX_CHATS,
  SEARCH_MAX_HITS_PER_CHAT,
} from "./chat/search";
import { listPanelDirectory, readPanelFile } from "./workspace-panel";

interface ChatRow {
  created_at: number;
  id: string;
  title: string;
  updated_at: number;
}

export class OrgAgent extends Agent<Cloudflare.Env, OrgAgentState> {
  initialState: OrgAgentState = { chats: [] };

  workspace = new Workspace({
    storage: this.ctx.storage,
    backends: [
      new WorkerJavaScriptBackend({ id: "js", loader: this.env.LOADER }),
    ],
  });

  override async onStart(): Promise<void> {
    this.ensureChatMeta();

    this.sql`CREATE TABLE IF NOT EXISTS org_memory (
      label TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    )`;

    // A forwarded close re-inserts a deleted facet's registry row.
    await this.sweepOrphanChats();
    this.refreshChatState();
  }

  private ensureChatMeta(): void {
    this.sql`CREATE TABLE IF NOT EXISTS chat_meta (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`;
  }

  private async sweepOrphanChats(): Promise<void> {
    const ids = new Set(
      this.sql<{ id: string }>`SELECT id FROM chat_meta`.map((row) => row.id)
    );
    for (const entry of this.dynamicAgents.list(OrgChat)) {
      if (!ids.has(entry.name)) {
        await this.dynamicAgents.delete(OrgChat, entry.name);
      }
    }
  }

  private hasChat(id: string): boolean {
    this.ensureChatMeta();
    const rows = this.sql<{ id: string }>`
      SELECT id FROM chat_meta WHERE id = ${id} LIMIT 1`;
    return rows.length > 0;
  }

  override onBeforeSubAgent(
    _req: Request,
    { className, name }: { className: string; name: string }
  ): Promise<Response | undefined> {
    // A chat exists iff its chat_meta row does; this hook never creates.
    if (className !== OrgChat.name || !this.hasChat(name)) {
      return Promise.resolve(
        new Response(`${className} "${name}" not found`, { status: 404 })
      );
    }
    return Promise.resolve(undefined);
  }

  /** `WorkspaceStubHost` for `getWorkspace(stub)`. */
  async __getWorkspaceStub(): Promise<WorkspaceStub> {
    await this.workspace.ready();
    return this.workspace.stub();
  }

  announceWorkspaceChange(): void {
    this.broadcast(
      JSON.stringify({
        type: WORKSPACE_CHANGE_FRAME,
      } satisfies WorkspaceChangeFrame)
    );
  }

  touchChat(chatId: string): Promise<void> {
    this
      .sql`UPDATE chat_meta SET updated_at = ${Date.now()} WHERE id = ${chatId}`;
    this.refreshChatState();
    return Promise.resolve();
  }

  readOrgMemory(label: string): Promise<string | null> {
    const rows = this.sql<{ content: string }>`
      SELECT content FROM org_memory WHERE label = ${label}`;
    return Promise.resolve(rows[0]?.content ?? null);
  }

  writeOrgMemory(label: string, content: string): Promise<void> {
    this.sql`INSERT INTO org_memory (label, content, updated_at)
      VALUES (${label}, ${content}, ${Date.now()})
      ON CONFLICT(label) DO UPDATE SET
        content = excluded.content,
        updated_at = excluded.updated_at`;
    return Promise.resolve();
  }

  @callable()
  getOrgMemory(label = "org_memory"): OrgMemorySnapshot {
    const rows = this.sql<{ content: string; updated_at: number }>`
      SELECT content, updated_at FROM org_memory WHERE label = ${label}`;
    const row = rows[0];
    return {
      content: row?.content ?? null,
      updatedAt: row?.updated_at ?? null,
    };
  }

  /**
   * Re-derive the chat list and broadcast it as agent state — the sidebar's
   * source of truth (upstream directory `_refreshState` pattern). Every
   * mutation (create/rename/delete/touch) refreshes, so all tabs and the
   * ordering stay live without per-client re-fetching.
   */
  private refreshChatState(): void {
    this.setState({ ...this.state, chats: this.listChats() });
  }

  /**
   * The chat list is server-derived from chat_meta and org-wide, so a
   * client must never be able to push one — reject any connection-sourced
   * update (agents state.md › Validating State Updates).
   */
  override validateStateChange(
    _nextState: OrgAgentState,
    source: Connection | "server"
  ): void {
    if (source !== "server") {
      throw new Error("OrgAgent state is server-managed");
    }
  }

  @callable()
  listChats(): ChatSummary[] {
    this.ensureChatMeta();
    return this.sql<ChatRow>`
      SELECT id, title, created_at, updated_at FROM chat_meta
      ORDER BY updated_at DESC`.map((row) => ({
      id: row.id,
      title: row.title,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  /**
   * First send. The client mints the id. The user message is stored on the
   * facet before `chat_meta` is inserted, so a crash leaves an unlisted
   * orphan that `onStart` sweeps instead of an empty titled row. A chat that
   * already has a row is returned as-is (no second user message). A facet
   * that is registered without a row — a crash orphan, or a delete whose
   * registry row came back — is refused, so this call cannot resurrect it.
   */
  @callable()
  async startChat(input: {
    id: string;
    title?: string;
    message: StartChatMessage;
  }): Promise<ChatSummary> {
    const id = input?.id;
    if (typeof id !== "string" || !CHAT_ID_PATTERN.test(id)) {
      throw new Error("Invalid chat id");
    }
    const message = startChatMessage(input.message);
    this.ensureChatMeta();
    const existing = this.chatSummary(id);
    if (existing) {
      return existing;
    }
    // Checked before get(): get() itself registers the facet.
    if (this.dynamicAgents.has(OrgChat, id)) {
      throw new Error("Chat is not available");
    }

    const now = Date.now();
    const title = capChatTitle(input.title?.trim() || defaultChatTitle(now));
    const child = await this.dynamicAgents.get(OrgChat, id);
    await child.addMessages([message]);
    try {
      this.sql`INSERT INTO chat_meta (id, title, created_at, updated_at)
        VALUES (${id}, ${title}, ${now}, ${now})`;
    } catch (error) {
      // A concurrent start of this same id inserted the row while get()
      // was in flight. The message append is idempotent by id.
      if (isUniqueConstraint(error)) {
        const raced = this.chatSummary(id);
        if (raced) {
          return raced;
        }
      }
      throw error;
    }
    this.refreshChatState();
    return { id, title, createdAt: now, updatedAt: now };
  }

  private chatSummary(id: string): ChatSummary | undefined {
    this.ensureChatMeta();
    const rows = this.sql<ChatRow>`
      SELECT id, title, created_at, updated_at FROM chat_meta
      WHERE id = ${id} LIMIT 1`;
    const row = rows[0];
    if (!row) {
      return;
    }
    return {
      id: row.id,
      title: row.title,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  @callable()
  renameChat(id: string, title: string): Promise<void> {
    const trimmed = capChatTitle(title.trim());
    if (!trimmed) {
      return Promise.resolve();
    }
    this.ensureChatMeta();
    this.sql`UPDATE chat_meta SET title = ${trimmed}, updated_at = ${Date.now()}
      WHERE id = ${id}`;
    this.refreshChatState();
    return Promise.resolve();
  }

  @callable()
  async deleteChat(id: string): Promise<void> {
    this.ensureChatMeta();
    // Meta first, so the chat is already gone if facet deletion fails or a
    // late forward re-registers it. No re-seed — zero chats is valid.
    this.sql`DELETE FROM chat_meta WHERE id = ${id}`;
    try {
      await this.dynamicAgents.delete(OrgChat, id);
    } finally {
      this.refreshChatState();
    }
  }

  /**
   * Org-scoped conversation search: fan the query out to at most the
   * `SEARCH_MAX_CHATS` most recent chats, each through its own Sessions FTS5
   * index (`OrgChat.searchMessages`), and merge into one newest-first list.
   * Every chat lives under this org's DO and the `/agents/org-agent/` route
   * gate, so results can never cross orgs. A chat that fails to search is
   * skipped (logged) rather than failing the whole query.
   */
  @callable()
  async searchChats(query: string): Promise<ChatSearchHit[]> {
    const trimmed = query.trim();
    if (!trimmed) {
      return [];
    }
    const recent = this.listChats().slice(0, SEARCH_MAX_CHATS);
    const hitsPerChat = new Map<string, ChatMessageHit[]>();
    for (const chat of recent) {
      try {
        const child = await this.dynamicAgents.get(OrgChat, chat.id);
        hitsPerChat.set(
          chat.id,
          await child.searchMessages(trimmed, SEARCH_MAX_HITS_PER_CHAT)
        );
      } catch (error) {
        structuredLog({
          kind: "org_chat_search_failed",
          severity: "error",
          organizationId: this.name,
          chatName: chat.id,
          error: errorMessage(error),
        });
      }
    }
    return mergeChatSearchResults(recent, hitsPerChat);
  }

  @callable()
  listWorkspace(dir = WORKSPACE_ROOT): Promise<WorkspaceFileInfo[]> {
    return listPanelDirectory(this.workspace.fs, dir);
  }

  @callable()
  readWorkspaceFile(path: string): Promise<string | null> {
    return readPanelFile(this.workspace.fs, path);
  }
}

// No title limit in the contract; this only stops an unbounded rename.
const CHAT_TITLE_MAX_LENGTH = 200;

function capChatTitle(title: string): string {
  return title.length <= CHAT_TITLE_MAX_LENGTH
    ? title
    : title.slice(0, CHAT_TITLE_MAX_LENGTH);
}

function defaultChatTitle(timestamp: number): string {
  return `Chat ${new Date(timestamp).toISOString().slice(0, 16).replace("T", " ")}`;
}

/** Client-minted chat ids are 8 random bytes, hex. E2E matches this shape. */
const CHAT_ID_PATTERN = /^[0-9a-f]{16}$/;

interface StartChatMessage {
  id: string;
  role: "user";
  parts: UIMessage["parts"];
}

function startChatMessage(message: StartChatMessage | undefined): UIMessage {
  const id = message?.id;
  const parts = message?.parts;
  if (
    message?.role !== "user" ||
    typeof id !== "string" ||
    id.trim() === "" ||
    id.length > 128 ||
    !Array.isArray(parts) ||
    parts.length === 0
  ) {
    throw new Error("A user message is required to start a chat");
  }
  return { id, role: "user", parts };
}

function isUniqueConstraint(error: unknown): boolean {
  const text = error instanceof Error ? error.message : String(error);
  return text.includes("UNIQUE constraint failed");
}
