// AI chat commands — the contract the frontend is written against.
//
// All network access for the AI feature happens here in Rust: API keys
// never leave the keychain except to be attached to an outgoing request,
// and the webview's CSP is never relaxed for AI provider hosts because the
// webview never talks to them directly.

use std::future::Future;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, PoisonError};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, State};
use tokio::sync::mpsc;
use tokio_util::sync::CancellationToken;

use crate::ai::prompt;
use crate::ai::{self, HttpClient, Message, StreamChunk};
use crate::keyring;

/// Holds the `CancellationToken` for the in-flight `send_ai_message` stream,
/// if any. A plain `std::sync::Mutex` (not `tokio::sync::Mutex`) matches the
/// rest of this codebase's state — see `PendingFileOpen` in `file_open.rs`
/// — since every critical section here is a quick take/replace with no
/// `.await` inside it.
pub struct CancelState(pub Mutex<Option<CancellationToken>>);

/// One entry of `list_ai_providers`'s result. Serialized as
/// `{ provider: "anthropic", hasApiKey: true }`.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiProviderStatus {
    pub provider: String,
    pub has_api_key: bool,
}

/// Provider/model selection sent by the frontend for `test_ai_provider` and
/// `send_ai_message`. Received as `{ provider, model, baseUrl }`.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiRequestConfig {
    pub provider: String,
    pub model: String,
    pub base_url: Option<String>,
}

/// One turn of the conversation as sent by the frontend. Received as
/// `{ role: "user" | "assistant", content: "..." }`. The frontend never
/// sends a `role: "system"` entry — Rust owns the system prompt.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatMessageInput {
    pub role: String,
    pub content: String,
}

/// Wire shape of the `ai-stream` event. Distinct from `ai::StreamChunk`
/// because every emitted chunk must carry `streamId` — stamped on here, at
/// the point of emission, rather than threaded through the provider layer
/// which has no notion of a stream id. `#[serde(tag = "type", rename_all =
/// "kebab-case")]` on the enum plus `rename_all = "camelCase"` per variant
/// produces exactly `{ "type": "text-delta", "streamId": "...", "text":
/// "..." }` and friends.
#[derive(Serialize, Clone)]
#[serde(tag = "type", rename_all = "kebab-case")]
enum AiStreamEvent {
    #[serde(rename_all = "camelCase")]
    TextDelta { stream_id: String, text: String },
    #[serde(rename_all = "camelCase")]
    Done {
        stream_id: String,
        tokens_in: u32,
        tokens_out: u32,
    },
    #[serde(rename_all = "camelCase")]
    Error { stream_id: String, message: String },
}

impl AiStreamEvent {
    fn from_chunk(chunk: StreamChunk, stream_id: &str) -> Self {
        match chunk {
            StreamChunk::TextDelta { text } => AiStreamEvent::TextDelta {
                stream_id: stream_id.to_string(),
                text,
            },
            StreamChunk::Error { message } => AiStreamEvent::Error {
                stream_id: stream_id.to_string(),
                message,
            },
        }
    }
}

/// Reports, for each of the four providers, whether an API key is present
/// in the keychain. Ollama always reports `false` — it needs no key, so a
/// missing entry there is not something the Settings UI should flag.
#[tauri::command]
pub fn list_ai_providers() -> Result<Vec<AiProviderStatus>, String> {
    ai::PROVIDER_IDS
        .iter()
        .map(|&provider| {
            let has_api_key = ai::requires_api_key(provider) && keyring::get_api_key(provider)?.is_some();
            Ok(AiProviderStatus {
                provider: provider.to_string(),
                has_api_key,
            })
        })
        .collect()
}

/// Stores an API key in the keychain. An empty string deletes the entry
/// instead of storing an empty credential — that's how the Settings UI
/// represents "clear this key".
#[tauri::command]
pub fn save_ai_api_key(provider: String, api_key: String) -> Result<(), String> {
    if api_key.is_empty() {
        keyring::delete_api_key(&provider)
    } else {
        keyring::store_api_key(&provider, &api_key)
    }
}

#[tauri::command]
pub fn delete_ai_api_key(provider: String) -> Result<(), String> {
    keyring::delete_api_key(&provider)
}

/// Sends a minimal request ("reply with OK") and returns the model's text,
/// or an error carrying the provider's (redacted) error message. Backs the
/// Settings "Test" button.
///
/// Reuses the streaming provider implementation but discards the channel
/// receiver — the caller only wants the final accumulated text, not
/// incremental chunks, so there is no need for a second non-streaming code
/// path per provider.
#[tauri::command]
pub async fn test_ai_provider(
    http_client: State<'_, HttpClient>,
    config: AiRequestConfig,
) -> Result<String, String> {
    let messages = vec![Message::User {
        content: "Reply with the single word OK.".to_string(),
    }];

    let (chunk_tx, _chunk_rx) = mpsc::unbounded_channel::<StreamChunk>();
    let response = ai::send_message(
        &http_client.0,
        &config.provider,
        &config.model,
        config.base_url.as_deref(),
        &messages,
        &chunk_tx,
    )
    .await
    .map_err(|e| e.to_string())?;

    Ok(response.text.trim().to_string())
}

/// Starts an AI chat stream. Cancels any stream already in flight, stores a
/// fresh `CancellationToken` in managed state, then spawns the provider
/// call as a background task and returns immediately — the caller is not
/// blocked waiting for the model to finish responding.
///
/// Rust — not the frontend — prepends the system prompt and embeds
/// `diagram_source` into the latest user turn (see `ai::prompt`), so the
/// wire contract never carries a system message.
#[tauri::command]
pub fn send_ai_message(
    app: AppHandle,
    http_client: State<'_, HttpClient>,
    cancel_state: State<'_, CancelState>,
    config: AiRequestConfig,
    messages: Vec<ChatMessageInput>,
    diagram_source: String,
    stream_id: String,
) -> Result<(), String> {
    let client = http_client.0.clone();
    let ai_messages = build_ai_messages(messages, &diagram_source);

    // Cancel whatever stream was previously running and install a fresh
    // token for this one. Taken and replaced under a single lock so a
    // concurrent `cancel_ai_stream` call can never observe a half-updated
    // state.
    let token = {
        let mut guard = cancel_state
            .0
            .lock()
            .unwrap_or_else(PoisonError::into_inner);
        if let Some(previous) = guard.take() {
            previous.cancel();
        }
        let token = CancellationToken::new();
        *guard = Some(token.clone());
        token
    };

    // `tauri::async_runtime::spawn` works regardless of whether the calling
    // command is itself `async` — unlike `tokio::spawn`, it doesn't depend
    // on the caller already being inside a Tokio task context.
    tauri::async_runtime::spawn(run_stream(
        app,
        client,
        config,
        ai_messages,
        stream_id,
        token,
    ));

    Ok(())
}

/// Cancels the currently running `send_ai_message` stream, if any. A
/// cancelled stream emits nothing further — no error event — since the
/// user asked for it to stop, not for it to fail.
#[tauri::command]
pub fn cancel_ai_stream(cancel_state: State<'_, CancelState>) -> Result<(), String> {
    let mut guard = cancel_state
        .0
        .lock()
        .unwrap_or_else(PoisonError::into_inner);
    if let Some(token) = guard.take() {
        token.cancel();
    }
    Ok(())
}

/// Converts the frontend's message list into the provider-agnostic
/// `Message` enum, prepending the system prompt and embedding
/// `diagram_source` into the latest user turn — the last message with
/// `role: "user"`. Earlier turns are passed through unchanged: they
/// reflect what the assistant actually saw and said at the time, and
/// re-embedding a since-changed diagram into them would misrepresent the
/// conversation.
fn build_ai_messages(messages: Vec<ChatMessageInput>, diagram_source: &str) -> Vec<Message> {
    let messages = normalize_turns(messages);

    let mut ai_messages = vec![Message::System {
        content: prompt::system_prompt().to_string(),
    }];

    let latest_user_index = messages.iter().rposition(|m| m.role == "user");

    for (i, msg) in messages.into_iter().enumerate() {
        let is_latest_user_turn = Some(i) == latest_user_index;
        let content = if is_latest_user_turn {
            prompt::compose_user_turn(&msg.content, diagram_source)
        } else {
            msg.content
        };

        if msg.role == "assistant" {
            ai_messages.push(Message::Assistant { content });
        } else {
            ai_messages.push(Message::User { content });
        }
    }

    ai_messages
}

/// Normalizes the conversation into the shape every provider accepts: no
/// empty turns, and no two consecutive turns from the same role.
///
/// Both malformed shapes are reachable from the UI — stopping a reply
/// before its first chunk leaves an empty assistant turn behind, and
/// retrying a failed turn or superseding an in-flight one puts two user
/// turns in a row. The Anthropic Messages API rejects either with a 400, so
/// the *next* message fails for a reason that has nothing to do with what
/// the user typed, while OpenAI tolerates both — exactly the kind of
/// provider-specific break that manual testing misses. Enforced here rather
/// than in the frontend because this is the layer that actually builds the
/// request, so no future caller can reintroduce it.
fn normalize_turns(messages: Vec<ChatMessageInput>) -> Vec<ChatMessageInput> {
    let mut normalized: Vec<ChatMessageInput> = Vec::new();

    for message in messages {
        if message.content.trim().is_empty() {
            continue;
        }

        match normalized.last_mut() {
            // Joined rather than dropped: an unanswered earlier question is
            // still something the user asked, and discarding it would
            // quietly change the request the model is answering.
            Some(previous) if previous.role == message.role => {
                previous.content.push_str("\n\n");
                previous.content.push_str(&message.content);
            }
            _ => normalized.push(message),
        }
    }

    normalized
}

/// Runs `future` unless `cancel_token` fires first, returning `None` when it
/// does.
///
/// Cancellation has to *drop* the request future, not merely be observed
/// alongside it: dropping is what closes the connection and stops the
/// provider generating. Polling the token instead — the shape this
/// replaced — left the response body being read to completion after Stop,
/// so the reply was still generated and still billed, and two sends in
/// quick succession ran two full streams side by side.
///
/// `biased` makes the token win a tie, so a cancel that lands in the same
/// poll as the final chunk still counts as a cancel.
async fn run_cancellable<F: Future>(
    cancel_token: &CancellationToken,
    future: F,
) -> Option<F::Output> {
    tokio::select! {
        biased;
        () = cancel_token.cancelled() => None,
        output = future => Some(output),
    }
}

/// Runs the provider call to completion, forwarding chunks to the frontend
/// as `ai-stream` events tagged with `stream_id`. Spawned as a background
/// task by `send_ai_message`, which has already returned by the time this
/// runs.
async fn run_stream(
    app: AppHandle,
    client: reqwest::Client,
    config: AiRequestConfig,
    messages: Vec<Message>,
    stream_id: String,
    cancel_token: CancellationToken,
) {
    let (chunk_tx, mut chunk_rx) = mpsc::unbounded_channel::<StreamChunk>();

    // Tracks whether a provider-originated `StreamChunk::Error` already
    // reached the frontend, so the fallback error emit below (for errors
    // that never went through the channel, e.g. a connection failure) never
    // sends a second, redundant error event for the same failure.
    let error_already_emitted = Arc::new(AtomicBool::new(false));

    let forwarder = tokio::spawn({
        let app = app.clone();
        let stream_id = stream_id.clone();
        let cancel_token = cancel_token.clone();
        let error_already_emitted = error_already_emitted.clone();
        async move {
            while let Some(chunk) = chunk_rx.recv().await {
                // Keep draining so `send_message`'s sends never block, but
                // stop emitting the moment cancellation is observed — a
                // cancelled stream must emit nothing further.
                if cancel_token.is_cancelled() {
                    continue;
                }
                if matches!(chunk, StreamChunk::Error { .. }) {
                    error_already_emitted.store(true, Ordering::SeqCst);
                }
                let event = AiStreamEvent::from_chunk(chunk, &stream_id);
                let _ = app.emit("ai-stream", &event);
            }
        }
    });

    let outcome = run_cancellable(
        &cancel_token,
        ai::send_message(
            &client,
            &config.provider,
            &config.model,
            config.base_url.as_deref(),
            &messages,
            &chunk_tx,
        ),
    )
    .await;
    // Dropping the sender lets the forwarder's `recv()` loop end.
    drop(chunk_tx);
    let _ = forwarder.await;

    // `None` means the token fired first: the request future has been
    // dropped, so there is no result to report and nothing left to emit.
    let Some(result) = outcome else {
        return;
    };

    if cancel_token.is_cancelled() {
        return;
    }

    match result {
        Ok(response) => {
            let _ = app.emit(
                "ai-stream",
                &AiStreamEvent::Done {
                    stream_id,
                    tokens_in: response.tokens_in,
                    tokens_out: response.tokens_out,
                },
            );
        }
        Err(e) => {
            if !error_already_emitted.load(Ordering::SeqCst) {
                let _ = app.emit(
                    "ai-stream",
                    &AiStreamEvent::Error {
                        stream_id,
                        message: e.to_string(),
                    },
                );
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn build_ai_messages_prepends_system_prompt() {
        let messages = build_ai_messages(vec![], "graph TD; A-->B;");
        assert!(matches!(messages.first(), Some(Message::System { .. })));
    }

    #[test]
    fn build_ai_messages_embeds_diagram_in_latest_user_turn_only() {
        let input = vec![
            ChatMessageInput {
                role: "user".into(),
                content: "first question".into(),
            },
            ChatMessageInput {
                role: "assistant".into(),
                content: "first answer".into(),
            },
            ChatMessageInput {
                role: "user".into(),
                content: "second question".into(),
            },
        ];
        let messages = build_ai_messages(input, "graph TD; A-->B;");

        let Message::User { content: first_user } = &messages[1] else {
            panic!("expected first user message");
        };
        assert_eq!(first_user, "first question");
        assert!(!first_user.contains("```mermaid"));

        let Message::User {
            content: latest_user,
        } = &messages[3]
        else {
            panic!("expected latest user message");
        };
        assert!(latest_user.contains("```mermaid\ngraph TD; A-->B;\n```"));
        assert!(latest_user.ends_with("second question"));
    }

    // Stopping a reply before its first chunk leaves an empty assistant
    // bubble in the transcript; sending it would 400 on Anthropic and make
    // the *next* message fail for an unrelated-looking reason.
    #[test]
    fn build_ai_messages_drops_empty_turns() {
        let input = vec![
            ChatMessageInput {
                role: "user".into(),
                content: "draw a flowchart".into(),
            },
            ChatMessageInput {
                role: "assistant".into(),
                content: "   ".into(),
            },
        ];
        let messages = build_ai_messages(input, "");

        assert_eq!(messages.len(), 2, "system prompt + the one real turn");
        assert!(matches!(messages[1], Message::User { .. }));
    }

    // Retrying a failed turn, or superseding one still in flight, puts two
    // user turns in a row — which the Anthropic Messages API rejects.
    #[test]
    fn build_ai_messages_merges_consecutive_same_role_turns() {
        let input = vec![
            ChatMessageInput {
                role: "user".into(),
                content: "first".into(),
            },
            ChatMessageInput {
                role: "user".into(),
                content: "second".into(),
            },
        ];
        let messages = build_ai_messages(input, "");

        assert_eq!(messages.len(), 2);
        let Message::User { content } = &messages[1] else {
            panic!("expected a single merged user message");
        };
        assert!(content.contains("first"));
        assert!(content.ends_with("second"));
    }

    #[test]
    fn build_ai_messages_alternates_roles_after_normalizing() {
        let input = vec![
            ChatMessageInput {
                role: "user".into(),
                content: "a".into(),
            },
            ChatMessageInput {
                role: "assistant".into(),
                content: String::new(),
            },
            ChatMessageInput {
                role: "user".into(),
                content: "b".into(),
            },
            ChatMessageInput {
                role: "assistant".into(),
                content: "answer".into(),
            },
            ChatMessageInput {
                role: "user".into(),
                content: "c".into(),
            },
        ];
        let messages = build_ai_messages(input, "");

        let roles: Vec<&str> = messages
            .iter()
            .map(|m| match m {
                Message::System { .. } => "system",
                Message::User { .. } => "user",
                Message::Assistant { .. } => "assistant",
            })
            .collect();
        assert_eq!(roles, vec!["system", "user", "assistant", "user"]);
    }

    // The point of `run_cancellable` is that the request future is DROPPED,
    // not merely ignored — dropping is what closes the connection and stops
    // the provider (and the billing). A future that is still alive would
    // never run this guard's destructor.
    #[tokio::test]
    async fn run_cancellable_drops_the_future_when_the_token_fires() {
        struct DropFlag(Arc<AtomicBool>);
        impl Drop for DropFlag {
            fn drop(&mut self) {
                self.0.store(true, Ordering::SeqCst);
            }
        }

        let dropped = Arc::new(AtomicBool::new(false));
        let token = CancellationToken::new();
        token.cancel();

        let flag = DropFlag(dropped.clone());
        let never_finishes = async move {
            let _guard = flag;
            std::future::pending::<()>().await;
        };

        assert!(run_cancellable(&token, never_finishes).await.is_none());
        assert!(
            dropped.load(Ordering::SeqCst),
            "request future was not dropped"
        );
    }

    #[tokio::test]
    async fn run_cancellable_returns_the_output_when_the_token_never_fires() {
        let token = CancellationToken::new();
        assert_eq!(run_cancellable(&token, async { 42 }).await, Some(42));
    }

    #[test]
    fn build_ai_messages_maps_assistant_role() {
        let input = vec![ChatMessageInput {
            role: "assistant".into(),
            content: "hello".into(),
        }];
        let messages = build_ai_messages(input, "");
        assert!(matches!(messages[1], Message::Assistant { .. }));
    }
}
