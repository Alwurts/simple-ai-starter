import { describe, expect, it } from "vitest";
import { commandPaletteShortcutLabel } from "./command-shortcut";

describe("commandPaletteShortcutLabel", () => {
  it("reads ⌘K on Apple platforms", () => {
    expect(
      commandPaletteShortcutLabel(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15"
      )
    ).toBe("⌘K");
    expect(
      commandPaletteShortcutLabel(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15"
      )
    ).toBe("⌘K");
  });

  it("reads Ctrl K elsewhere", () => {
    expect(
      commandPaletteShortcutLabel(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      )
    ).toBe("Ctrl K");
    expect(
      commandPaletteShortcutLabel(
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36"
      )
    ).toBe("Ctrl K");
    expect(commandPaletteShortcutLabel("")).toBe("Ctrl K");
  });
});
