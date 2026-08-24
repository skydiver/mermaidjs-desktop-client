/**
 * Family names permitted in a CSS `font-family` declaration.
 *
 * `editorFontFamily` is a CSS trust boundary: `createEditorTheme` interpolates
 * it raw into a declaration, so only characters that cannot break out of a
 * quoted value are allowed through. Verified against real monospace family
 * names (JetBrains Mono, SF Mono, PT Mono, IBM Plex Mono, Menlo, Consolas,
 * Fira Code) — all pass. Non-Latin-script family names (e.g. some CJK system
 * fonts) are rejected and fall back to the default stack; that is a safe
 * degradation, not a crash or an injection.
 *
 * A pattern rather than an allowlist against `list_monospace_fonts`, which is
 * unavailable outside Tauri and empty in Vite-only dev.
 *
 * Applied twice on purpose: once in `validateSettings` when loading persisted
 * settings, and again in `createEditorTheme`, which has its own trust boundary
 * because a future caller could build a theme without going through the
 * settings loader.
 *
 * `is_css_safe_family` in `src-tauri/src/lib.rs` is a third, deliberate copy —
 * it filters the font list at enumeration time and cannot share this constant
 * across the language boundary. Keep the three in step.
 */
export const CSS_SAFE_FONT_FAMILY_PATTERN = /^[A-Za-z0-9 _-]+$/;
