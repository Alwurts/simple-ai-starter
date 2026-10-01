const APPLE_PLATFORM = /mac|iphone|ipad|ipod/i;

/** ⌘K on Apple platforms, Ctrl K elsewhere (the palette footer hint). */
export function commandPaletteShortcutLabel(userAgent: string): string {
  return APPLE_PLATFORM.test(userAgent) ? "⌘K" : "Ctrl K";
}

export function currentPaletteShortcutLabel(): string {
  // SSR renders the (closed) palette without a navigator; default to the
  // non-Apple label there.
  const userAgent = typeof navigator === "undefined" ? "" : navigator.userAgent;
  return commandPaletteShortcutLabel(userAgent);
}
