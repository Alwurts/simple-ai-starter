import { DurableObject } from "cloudflare:workers";
import { Lifecycle } from "agents/lifecycle";
import { Sessions } from "agents/sessions";

/**
 * Test-only session host (compaction.workerd.test.ts): a plain Durable Object
 * with the agents `Sessions` capability installed — the smallest real seam
 * that owns Sessions SQLite. `runInDurableObject` drives it directly so the
 * OrgChat compaction wiring (configureSession + the `session.compact()` call
 * behind Think's compactAfter / contextOverflow triggers) runs against a
 * genuine session without spawning a Think agent (the vitest pool cannot
 * spawn facets and the pool has no model).
 */
export class SessionHost extends DurableObject<Cloudflare.Env> {
  readonly sessions = new Sessions();
  readonly lifecycle = Lifecycle.install(this).use(this.sessions);
  readonly session = this.sessions.session();
}
