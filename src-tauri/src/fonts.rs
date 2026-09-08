#[cfg(target_os = "macos")]
#[tauri::command]
pub fn list_monospace_fonts() -> Vec<String> {
    use core_text::font_collection::create_for_all_families;
    use core_text::font_descriptor::kCTFontMonoSpaceTrait;
    use core_text::font_descriptor::TraitAccessors;
    use std::collections::BTreeSet;

    let collection = create_for_all_families();
    let Some(descriptors) = collection.get_descriptors() else {
        return Vec::new();
    };

    // A `BTreeSet` dedupes and orders in a single step. The previous `Vec`
    // needed a linear `contains` per family — O(n²) string comparisons over
    // every installed family — plus a final `sort`.
    let mut fonts: BTreeSet<String> = BTreeSet::new();
    for i in 0..descriptors.len() {
        // The index comes from `0..len()`, so this can never miss; still,
        // `get` returning `Option` is not worth a panic inside a command.
        let Some(descriptor) = descriptors.get(i) else {
            continue;
        };
        let traits = descriptor.traits();
        if (traits.symbolic_traits() & kCTFontMonoSpaceTrait) == 0 {
            continue;
        }
        let name = descriptor.family_name();
        if !name.starts_with('.') {
            fonts.insert(name);
        }
    }
    fonts.into_iter().collect()
}

/// Families offered when the platform has no enumeration path of its own
/// (Windows) or when fontconfig is unavailable / yields nothing usable.
#[cfg(not(target_os = "macos"))]
fn fallback_monospace_fonts() -> Vec<String> {
    vec![
        "Consolas".into(),
        "Courier New".into(),
        "Menlo".into(),
        "Monaco".into(),
    ]
}

/// The frontend's `createEditorTheme` interpolates `editorFontFamily` raw
/// into a CSS declaration, so `validate-settings.ts` rejects any family
/// outside `/^[A-Za-z0-9 _-]+$/` and falls back to the default stack.
/// Applying the same filter here keeps the Settings dropdown from offering
/// a font that would be silently discarded the moment it is persisted.
#[cfg(target_os = "linux")]
fn is_css_safe_family(name: &str) -> bool {
    !name.is_empty()
        && name
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, ' ' | '_' | '-'))
}

/// Enumerates monospace families through fontconfig's `fc-list`. Shelling
/// out keeps `libfontconfig1-dev` off the Linux build prerequisites —
/// fontconfig is present on every desktop install, and the hardcoded list
/// covers the case where it somehow is not. `:spacing=100` is fontconfig's
/// monospace selector.
#[cfg(target_os = "linux")]
#[tauri::command]
pub fn list_monospace_fonts() -> Vec<String> {
    use std::collections::BTreeSet;
    use std::process::Command;

    let Ok(output) = Command::new("fc-list")
        .args([":spacing=100", "family"])
        .output()
    else {
        return fallback_monospace_fonts();
    };
    if !output.status.success() {
        return fallback_monospace_fonts();
    }

    // Each line holds one font file's comma-separated family aliases, the
    // first being the canonical name and the rest localized or legacy
    // spellings. A `BTreeSet` dedupes across the many files sharing a
    // family and orders the result in a single step.
    let mut fonts: BTreeSet<String> = BTreeSet::new();
    for line in String::from_utf8_lossy(&output.stdout).lines() {
        let Some(name) = line.split(',').next() else {
            continue;
        };
        let name = name.trim();
        if !name.starts_with('.') && is_css_safe_family(name) {
            fonts.insert(name.to_owned());
        }
    }

    if fonts.is_empty() {
        fallback_monospace_fonts()
    } else {
        fonts.into_iter().collect()
    }
}

#[cfg(not(any(target_os = "macos", target_os = "linux")))]
#[tauri::command]
pub fn list_monospace_fonts() -> Vec<String> {
    fallback_monospace_fonts()
}
