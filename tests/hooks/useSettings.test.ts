import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, type AppSettings } from "../../src/hooks/useSettings";

describe("DEFAULT_SETTINGS", () => {
  it("has system theme by default", () => {
    expect(DEFAULT_SETTINGS.theme).toBe("system");
  });

  it("has sensible editor defaults", () => {
    expect(DEFAULT_SETTINGS.editorFontSize).toBeGreaterThan(0);
    expect(DEFAULT_SETTINGS.syntaxHighlighting).toBe(true);
  });

  it("has all required keys", () => {
    const keys: (keyof AppSettings)[] = [
      "theme",
      "editorFontFamily",
      "editorFontSize",
      "syntaxHighlighting",
    ];
    for (const key of keys) {
      expect(DEFAULT_SETTINGS).toHaveProperty(key);
    }
  });
});
