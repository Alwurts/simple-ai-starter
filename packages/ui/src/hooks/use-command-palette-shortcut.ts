"use client";

import { useEffect } from "react";

function isTypingTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement)
  );
}

/** Toggle the command palette on ⌘K / Ctrl+K or `/` (platform sidebar pattern). */
export function useCommandPaletteShortcut(onToggle: () => void) {
  // biome-ignore lint/plugin/no-use-effect: document keydown for ⌘K / Ctrl+K / /
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      // `/` is a typing character. ⌘K / Ctrl+K still opens the palette from
      // an input, where `/` must not be swallowed.
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onToggle();
        return;
      }
      if (e.key === "/" && !isTypingTarget(e.target)) {
        e.preventDefault();
        onToggle();
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [onToggle]);
}
