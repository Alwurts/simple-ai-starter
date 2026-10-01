/** Text vs binary decision from mime type (with an extension fallback). */
export function isTextFile(info: {
  mimeType?: string | null;
  name: string;
}): boolean {
  const mime = info.mimeType ?? "";
  if (mime.startsWith("text/")) {
    return true;
  }
  if (
    mime.includes("json") ||
    mime.includes("xml") ||
    mime.includes("javascript") ||
    mime.includes("typescript") ||
    mime.includes("csv") ||
    mime.includes("yaml") ||
    mime.includes("markdown")
  ) {
    return true;
  }
  if (mime && !mime.startsWith("application/octet-stream")) {
    // Known non-text mime (image/pdf/etc.) → treat as binary.
    return false;
  }
  const ext = info.name.split(".").pop()?.toLowerCase();
  const textExts = new Set([
    "txt",
    "md",
    "mdx",
    "json",
    "jsonl",
    "csv",
    "tsv",
    "yaml",
    "yml",
    "js",
    "jsx",
    "ts",
    "tsx",
    "html",
    "css",
    "sql",
    "sh",
    "toml",
    "env",
    "log",
    "xml",
  ]);
  return ext ? textExts.has(ext) : false;
}
