/** 8 random bytes as hex. E2E matches `/chat/[0-9a-f]{16}`. */
export function mintChatId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    ""
  );
}
