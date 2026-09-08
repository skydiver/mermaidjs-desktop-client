// API key storage — thin wrapper over the OS keychain (Keychain on macOS,
// Credential Manager on Windows, Secret Service on Linux).
//
// Only AI provider API keys live here — this app has no database
// credentials to store, unlike the sibling `tauri-dbchat` project this
// module was ported from.

use keyring::Entry;

/// Service name prefix distinguishes release keychain entries from debug
/// ones, so a developer running `cargo tauri dev` never overwrites — or
/// reads — the API key a released build stored.
#[cfg(debug_assertions)]
const SERVICE_PREFIX: &str = "dev.skydiver.mermaidjs-desktop-dev";

#[cfg(not(debug_assertions))]
const SERVICE_PREFIX: &str = "dev.skydiver.mermaidjs-desktop";

/// Build a keyring service name for an AI provider API key.
fn ai_service(provider: &str) -> String {
    format!("{}.ai.{}", SERVICE_PREFIX, provider)
}

/// Store an API key for an AI provider in the OS keychain.
pub fn store_api_key(provider: &str, key: &str) -> Result<(), String> {
    let entry = Entry::new(&ai_service(provider), "default")
        .map_err(|e| format!("Keyring error: {}", e))?;
    entry
        .set_password(key)
        .map_err(|e| format!("Failed to store credential: {}", e))
}

/// Retrieve an API key for an AI provider from the OS keychain.
/// Returns `Ok(None)` if no key has been stored for that provider.
pub fn get_api_key(provider: &str) -> Result<Option<String>, String> {
    let entry = Entry::new(&ai_service(provider), "default")
        .map_err(|e| format!("Keyring error: {}", e))?;
    match entry.get_password() {
        Ok(password) => Ok(Some(password)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(format!("Failed to retrieve credential: {}", e)),
    }
}

/// Delete an API key for an AI provider from the OS keychain.
/// Silently succeeds if no key was stored for that provider.
pub fn delete_api_key(provider: &str) -> Result<(), String> {
    let entry = Entry::new(&ai_service(provider), "default")
        .map_err(|e| format!("Keyring error: {}", e))?;
    match entry.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(format!("Failed to delete credential: {}", e)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // Service-name construction is the only pure logic in this module — the
    // Entry/keychain calls themselves need a real OS keychain and are not
    // exercised here (see the brief: no network/OS-credential calls in CI).

    #[test]
    fn ai_service_includes_provider_and_prefix() {
        let service = ai_service("anthropic");
        assert!(service.ends_with(".ai.anthropic"));
        #[cfg(debug_assertions)]
        assert_eq!(service, "dev.skydiver.mermaidjs-desktop-dev.ai.anthropic");
        #[cfg(not(debug_assertions))]
        assert_eq!(service, "dev.skydiver.mermaidjs-desktop.ai.anthropic");
    }

    #[test]
    fn ai_service_differs_per_provider() {
        assert_ne!(ai_service("anthropic"), ai_service("openai"));
        assert_ne!(ai_service("openai"), ai_service("ollama"));
        assert_ne!(ai_service("ollama"), ai_service("openai-compatible"));
    }
}
