// AI provider layer — turns a provider id + model + conversation into a
// streamed text response.
//
// This app has exactly one conversation in flight at a time, no tool
// calling, and no persistence: a provider's whole job is "take a system
// prompt and a list of turns, stream back text". That keeps this layer
// much smaller than a general-purpose agent runtime — see `prompt.rs` for
// where the Mermaid-specific behavior contract actually lives.
//
// Adding a fifth provider means: a new `<name>.rs` with a `send` function
// of the same shape, plus one arm in `send_message`'s match below.

pub mod anthropic;
pub mod ndjson;
pub mod ollama;
pub mod openai;
pub mod prompt;
pub mod sse;

use serde::Serialize;
use tokio::sync::mpsc::UnboundedSender;

/// Shared HTTP client for every provider request. A newtype so Tauri can
/// `.manage()` it as distinct state rather than colliding with any other
/// `reqwest::Client` some future plugin might register.
#[derive(Clone)]
pub struct HttpClient(pub reqwest::Client);

// ---------------------------------------------------------------------------
// Conversation model — no tool-call variants, no persistence: a turn is
// just who said it and what they said.
// ---------------------------------------------------------------------------

#[derive(Debug, Clone)]
pub enum Message {
    System { content: String },
    User { content: String },
    Assistant { content: String },
}

/// The accumulated result of one provider call, once its stream ends.
#[derive(Debug, Clone, Default)]
pub struct AiResponse {
    pub text: String,
    pub tokens_in: u32,
    pub tokens_out: u32,
}

/// One increment of a provider response, forwarded to the frontend as part
/// of the `ai-stream` event. `commands/ai.rs` stamps a `streamId` onto each
/// of these before emitting — that id isn't known at this layer, since a
/// provider has no notion of which UI stream it's serving.
///
/// No `Done` variant here: a provider only ever produces text or an error
/// while it's streaming — completion is signalled by the channel closing,
/// not by a chunk — so `commands/ai.rs::run_stream` builds the `Done`
/// `ai-stream` event itself from the final `AiResponse` once the provider
/// call returns `Ok`.
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "kebab-case")]
pub enum StreamChunk {
    TextDelta { text: String },
    Error { message: String },
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

#[derive(Debug, thiserror::Error)]
pub enum AiError {
    /// The request never got a usable response: transport failure, a non-2xx
    /// status not covered by a more specific variant below, or a malformed
    /// body from the provider.
    #[error("{0}")]
    Request(String),

    /// No key in the keychain, or the provider rejected the one it got
    /// (HTTP 401).
    #[error("{0}")]
    Auth(String),

    /// HTTP 429. Carries the `retry-after` the provider sent, if any, so a
    /// caller can decide whether to retry.
    #[error("Rate limited — retry after {retry_after_secs}s")]
    RateLimited { retry_after_secs: u64 },

    /// The response stream itself broke: a dropped connection, or bytes
    /// that don't parse as the wire format this provider promised.
    #[error("{0}")]
    Stream(String),

    /// The `(provider, model, base_url)` triple given to `send_message`
    /// can't produce a valid request — e.g. no model, or a base URL a
    /// provider requires but wasn't supplied. Caught before any network
    /// call is made.
    #[error("{0}")]
    Config(String),
}

/// Redacts a leaked API key out of a provider error message before it can
/// reach a Tauri event payload or an `Err` string returned to the frontend.
/// Providers don't normally echo the key back in an error body, but a
/// misconfigured proxy or a reflected-request error could; this is a
/// defensive backstop, not the primary safeguard (the key is never passed
/// as a command argument or put in a payload to begin with).
pub(crate) fn redact(message: &str, api_key: &str) -> String {
    if api_key.is_empty() {
        message.to_string()
    } else {
        message.replace(api_key, "[REDACTED]")
    }
}

// ---------------------------------------------------------------------------
// Provider identifiers
// ---------------------------------------------------------------------------

/// The provider ids the frontend can request, in the order
/// `commands::ai::list_ai_providers` reports them.
///
/// `openai` and `openai-compatible` share one wire implementation
/// (`openai::send`) — they differ only in which base URL and which
/// keychain entry to use, which is exactly why they're plain strings here
/// instead of two enum variants: the difference is data, not behavior.
pub const PROVIDER_IDS: [&str; 4] = ["anthropic", "openai", "ollama", "openai-compatible"];

/// Does this provider id need an API key at all? Ollama runs locally and
/// has no auth concept; the other three all need a keychain entry.
pub fn requires_api_key(provider_id: &str) -> bool {
    provider_id != "ollama"
}

/// Validates that `(provider_id, model, base_url)` is enough to attempt a
/// request, without making one. Kept separate from `send_message` so
/// `commands/ai.rs` can reject an obviously-broken config before it even
/// reads the keychain, and so the rule set is unit-testable without a
/// network stack.
pub fn validate_provider_config(
    provider_id: &str,
    model: &str,
    base_url: Option<&str>,
) -> Result<(), AiError> {
    if model.trim().is_empty() {
        return Err(AiError::Config("Model is required".into()));
    }

    let base_url_missing = base_url.map(str::trim).unwrap_or("").is_empty();

    match provider_id {
        "anthropic" | "openai" => Ok(()),
        "ollama" if base_url_missing => {
            Err(AiError::Config("Base URL is required for Ollama".into()))
        }
        "openai-compatible" if base_url_missing => Err(AiError::Config(
            "Base URL is required for OpenAI Compatible".into(),
        )),
        "ollama" | "openai-compatible" => Ok(()),
        other => Err(AiError::Config(format!("Unknown AI provider: {other}"))),
    }
}

/// Dispatches to the provider's wire implementation. This is the one
/// function a fifth provider's match arm gets added to; everything else in
/// this module is provider-agnostic.
pub async fn send_message(
    client: &reqwest::Client,
    provider_id: &str,
    model: &str,
    base_url: Option<&str>,
    messages: &[Message],
    chunk_tx: &UnboundedSender<StreamChunk>,
) -> Result<AiResponse, AiError> {
    validate_provider_config(provider_id, model, base_url)?;

    match provider_id {
        "anthropic" => anthropic::send(client, model, messages, chunk_tx).await,
        "openai" => {
            openai::send(
                client,
                openai::OPENAI_API_URL,
                "openai",
                "OpenAI",
                model,
                messages,
                chunk_tx,
            )
            .await
        }
        "openai-compatible" => {
            // `validate_provider_config` already rejected a missing
            // `base_url` for this id, so the `expect` below can't fire.
            let base_url = base_url.expect("validated above");
            openai::send(
                client,
                base_url,
                "openai-compatible",
                "OpenAI Compatible",
                model,
                messages,
                chunk_tx,
            )
            .await
        }
        "ollama" => {
            let base_url = base_url.expect("validated above");
            ollama::send(client, base_url, model, messages, chunk_tx).await
        }
        other => Err(AiError::Config(format!("Unknown AI provider: {other}"))),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_empty_model() {
        let err = validate_provider_config("anthropic", "  ", None).unwrap_err();
        assert!(matches!(err, AiError::Config(_)));
    }

    #[test]
    fn anthropic_and_openai_need_no_base_url() {
        assert!(validate_provider_config("anthropic", "claude-x", None).is_ok());
        assert!(validate_provider_config("openai", "gpt-x", None).is_ok());
    }

    #[test]
    fn ollama_requires_base_url() {
        let err = validate_provider_config("ollama", "llama3", None).unwrap_err();
        assert!(matches!(err, AiError::Config(_)));
        assert!(validate_provider_config("ollama", "llama3", Some("http://localhost:11434")).is_ok());
    }

    #[test]
    fn ollama_rejects_blank_base_url() {
        let err = validate_provider_config("ollama", "llama3", Some("   ")).unwrap_err();
        assert!(matches!(err, AiError::Config(_)));
    }

    #[test]
    fn openai_compatible_requires_base_url() {
        let err = validate_provider_config("openai-compatible", "any-model", None).unwrap_err();
        assert!(matches!(err, AiError::Config(_)));
        assert!(
            validate_provider_config("openai-compatible", "any-model", Some("http://x:1234"))
                .is_ok()
        );
    }

    #[test]
    fn rejects_unknown_provider() {
        let err = validate_provider_config("mystery", "model", None).unwrap_err();
        assert!(matches!(err, AiError::Config(_)));
    }

    #[test]
    fn redact_replaces_key_occurrences() {
        assert_eq!(redact("key sk-abc123 leaked", "sk-abc123"), "key [REDACTED] leaked");
        assert_eq!(redact("no key here", "sk-abc123"), "no key here");
        assert_eq!(redact("anything", ""), "anything");
    }

    #[test]
    fn requires_api_key_is_false_only_for_ollama() {
        assert!(!requires_api_key("ollama"));
        assert!(requires_api_key("anthropic"));
        assert!(requires_api_key("openai"));
        assert!(requires_api_key("openai-compatible"));
    }
}
