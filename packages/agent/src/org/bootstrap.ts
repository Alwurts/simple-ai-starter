/**
 * The user id stamped on a connection attachment in `onConnect`
 * (`connection.setState({ userId })`), or undefined when the connection is
 * absent or unstamped. Survives DO hibernation — onConnect does not re-run
 * on wake, the attachment does.
 */
export function resolveTurnUserId(
  connection: { state: unknown } | undefined
): string | undefined {
  return (connection?.state as { userId?: string } | null | undefined)?.userId;
}
