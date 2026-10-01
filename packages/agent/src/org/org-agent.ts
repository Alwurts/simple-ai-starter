import {
  type FileInfo,
  Workspace,
  type WorkspaceChangeEvent,
} from "@cloudflare/shell";
import { errorMessage, structuredLog } from "@workspace/log";
import { Agent, type Connection, callable } from "agents";
import type {
  ChatMessageHit,
  ChatSearchHit,
  ChatSummary,
  OrgAgentState,
  OrgMemorySnapshot,
} from "../types";
import { OrgChat } from "./chat";
import {
  mergeChatSearchResults,
  SEARCH_MAX_CHATS,
  SEARCH_MAX_HITS_PER_CHAT,
} from "./chat/search";

interface ChatRow {
  created_at: number;
  id: string;
  title: string;
  updated_at: number;
}

export class OrgAgent extends Agent<Cloudflare.Env, OrgAgentState> {
  initialState: OrgAgentState = { chats: [] };

  workspace = new Workspace({
    sql: this.ctx.storage.sql,
    name: () => this.name,
    onChange: (event) => this.broadcastWorkspaceChange(event),
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

  private broadcastWorkspaceChange(event: WorkspaceChangeEvent): void {
    // Fan a lightweight file-change signal to every client connected to this
    // OrgAgent (all chat tabs) so a workspace-backed UI can refresh live across
    // chats/tabs. Best-effort `broadcast` (not `setState`) — file churn should
    // not trigger heavier state re-broadcasts. Does not notify sibling
    // dynamic agents.
    this.broadcast(JSON.stringify({ type: "workspace-change", event }));
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

  @callable()
  async createChat(opts?: { title?: string }): Promise<ChatSummary> {
    const id = generateChatId();
    const now = Date.now();
    const title = capChatTitle(opts?.title?.trim() || defaultChatTitle(now));

    // get() before the row: a throw writes nothing listable, and a restart
    // before the insert is an orphan onStart sweeps. That hook holds
    // blockConcurrencyWhile, and the client connects only after this returns.
    await this.dynamicAgents.get(OrgChat, id);
    this.ensureChatMeta();
    this.sql`INSERT INTO chat_meta (id, title, created_at, updated_at)
      VALUES (${id}, ${title}, ${now}, ${now})`;
    this.refreshChatState();

    return { id, title, createdAt: now, updatedAt: now };
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

  // The generic fs methods below are internal (used by the SharedWorkspace
  // proxy) and intentionally NOT `@callable()`. These two thin
  // wrappers are the only workspace methods the browser can reach: read-only,
  // org-gated (the `/agents/org-agent/:id` route is scoped to the caller's
  // active org), and returning already-serializable values.

  @callable()
  listWorkspace(path = "/"): Promise<FileInfo[]> {
    return this.workspace.readDir(path);
  }

  @callable()
  readWorkspaceFile(path: string): Promise<string | null> {
    return this.workspace.readFile(path);
  }

  readFile(path: string) {
    return this.workspace.readFile(path);
  }

  readFileBytes(path: string) {
    return this.workspace.readFileBytes(path);
  }

  writeFile(
    path: string,
    content: string,
    mimeType?: Parameters<Workspace["writeFile"]>[2]
  ) {
    return this.workspace.writeFile(path, content, mimeType);
  }

  writeFileBytes(
    path: string,
    content: Parameters<Workspace["writeFileBytes"]>[1],
    mimeType?: Parameters<Workspace["writeFileBytes"]>[2]
  ) {
    return this.workspace.writeFileBytes(path, content, mimeType);
  }

  appendFile(
    path: string,
    content: string,
    mimeType?: Parameters<Workspace["appendFile"]>[2]
  ) {
    return this.workspace.appendFile(path, content, mimeType);
  }

  exists(path: string) {
    return this.workspace.exists(path);
  }

  readDir(path: string, opts?: Parameters<Workspace["readDir"]>[1]) {
    return this.workspace.readDir(path, opts);
  }

  rm(path: string, opts?: Parameters<Workspace["rm"]>[1]) {
    return this.workspace.rm(path, opts);
  }

  glob(pattern: string) {
    return this.workspace.glob(pattern);
  }

  mkdir(path: string, opts?: Parameters<Workspace["mkdir"]>[1]) {
    return this.workspace.mkdir(path, opts);
  }

  stat(path: string) {
    return this.workspace.stat(path);
  }

  lstat(path: string) {
    return this.workspace.lstat(path);
  }

  cp(src: string, dest: string, opts?: Parameters<Workspace["cp"]>[2]) {
    return this.workspace.cp(src, dest, opts);
  }

  mv(src: string, dest: string) {
    return this.workspace.mv(src, dest);
  }

  symlink(target: string, linkPath: string) {
    return this.workspace.symlink(target, linkPath);
  }

  readlink(path: string) {
    return this.workspace.readlink(path);
  }
}

// No title limit in the contract; this only stops an unbounded rename.
const CHAT_TITLE_MAX_LENGTH = 200;

function capChatTitle(title: string): string {
  return title.length <= CHAT_TITLE_MAX_LENGTH
    ? title
    : title.slice(0, CHAT_TITLE_MAX_LENGTH);
}

function generateChatId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function defaultChatTitle(timestamp: number): string {
  return `Chat ${new Date(timestamp).toISOString().slice(0, 16).replace("T", " ")}`;
}
