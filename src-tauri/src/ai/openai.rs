// OpenAI Chat Completions API — and any OpenAI-compatible server, since
// they speak the same wire format and differ only in URL and API key.
//
// Wire format notes:
// - Still SSE, but unlike Anthropic every event is a bare `data:` line —
//   `event_type` is always `None`. The stream ends with the literal line
//   `data: [DONE]`, which is not JSON and must be checked for before
//   attempting to parse the payload as such.
// - Token usage only appears in a final chunk that carries `usage` but no
//   `choices` — reachable only by requesting it via `stream_options:
//   {"include_usage": true}` in the request body; plenty of
//   OpenAI-compatible servers ignore that request option and simply never
//   send a usage chunk, which is why token counts default to 0 rather than
//   being treated as an error.
// - `choices[0].delta.content` carries incremental text. Some
//   OpenAI-compatible reasoning models (DeepSeek-R1 style) additionally
//   stream chain-of-thought under `delta.reasoning_content`; merging that
//   into the same text stream is deliberately out of scope here — this app
//   only cares about the final Mermaid answer, not an OpenAI-specific
//   reasoning trace, so `reasoning_content` is left unhandled and simply
//   doesn't appear in the output.

use reqwest::Client;
use serde_json::{json, Value};
use tokio::sync::mpsc::UnboundedSender;

use super::sse::{open_sse, SseEvent};
use super::{redact, AiError, AiResponse, Message, StreamChunk};
use crate::keyring;

pub const OPENAI_API_URL: &str = "https://api.openai.com/v1/chat/completions";

/// Upper bound on tokens generated per request. Generous enough to give a
/// full Mermaid diagram plus explanation room, including on reasoning
/// models that spend a chunk of the budget on chain-of-thought before the
/// final answer.
const MAX_TOKENS: u32 = 8192;

/// `api_url` and `keyring_service`/`display_name` are the only things that
/// differ between the plain `openai` provider and `openai-compatible`
/// (`ai::mod::send_message` supplies OpenAI's own constants for the
/// former); everything below is otherwise identical for both.
pub async fn send(
    client: &Client,
    api_url: &str,
    keyring_service: &str,
    display_name: &str,
    model: &str,
    messages: &[Message],
    chunk_tx: &UnboundedSender<StreamChunk>,
) -> Result<AiResponse, AiError> {
    let api_key = keyring::get_api_key(keyring_service)
        .map_err(AiError::Request)?
        .ok_or_else(|| {
            AiError::Auth(format!(
                "no {display_name} API key stored — add one in Settings"
            ))
        })?;

    let response = client
        .post(api_url)
        .header("Authorization", format!("Bearer {api_key}"))
        .json(&build_request_body(messages, model))
        .send()
        .await
        .map_err(|e| AiError::Request(e.to_string()))?;

    let mut stream = open_sse(response, Some(&api_key)).await?;
    let mut acc = Accumulator::default();

    while let Some(event) = stream.next().await? {
        if apply_event(&event, &mut acc, chunk_tx, &api_key)? {
            break; // data: [DONE]
        }
    }

    Ok(acc.into())
}

fn build_request_body(messages: &[Message], model: &str) -> Value {
    let api_messages: Vec<Value> = messages
        .iter()
        .map(|message| match message {
            Message::System { content } => json!({ "role": "system", "content": content }),
            Message::User { content } => json!({ "role": "user", "content": content }),
            Message::Assistant { content } => json!({ "role": "assistant", "content": content }),
        })
        .collect();

    json!({
        "model": model,
        "stream": true,
        "stream_options": { "include_usage": true },
        "max_tokens": MAX_TOKENS,
        "messages": api_messages,
    })
}

#[derive(Default)]
struct Accumulator {
    text: String,
    tokens_in: u32,
    tokens_out: u32,
}

impl From<Accumulator> for AiResponse {
    fn from(acc: Accumulator) -> Self {
        AiResponse {
            text: acc.text,
            tokens_in: acc.tokens_in,
            tokens_out: acc.tokens_out,
        }
    }
}

/// Folds one bare `data:` SSE event into `acc`. Returns `Ok(true)` on the
/// `[DONE]` sentinel — the signal to stop reading — `Ok(false)` for a
/// content or usage chunk, and `Err` if the payload carried an `error`
/// object (some OpenAI-compatible servers report failures this way, inside
/// an otherwise-200 stream, rather than as a non-2xx status).
///
/// Pulled out of `send`'s loop so it can be driven directly from a fixture
/// line sequence in tests, without a live HTTP stream.
fn apply_event(
    event: &SseEvent,
    acc: &mut Accumulator,
    chunk_tx: &UnboundedSender<StreamChunk>,
    api_key: &str,
) -> Result<bool, AiError> {
    let data = event.data.trim();
    if data.is_empty() {
        return Ok(false);
    }
    if data == "[DONE]" {
        return Ok(true);
    }

    let parsed: Value = serde_json::from_str(data)
        .map_err(|e| AiError::Stream(format!("invalid JSON in stream: {e}")))?;

    if let Some(err) = parsed.get("error") {
        let raw_message = err
            .get("message")
            .and_then(Value::as_str)
            .unwrap_or("unknown error");
        let message = redact(raw_message, api_key);
        let _ = chunk_tx.send(StreamChunk::Error {
            message: message.clone(),
        });
        return Err(AiError::Request(message));
    }

    // A chunk carrying `usage` but no `choices` is the final accounting
    // chunk (only sent when `stream_options.include_usage` was honored).
    let Some(delta) = parsed.pointer("/choices/0/delta") else {
        if let Some(usage) = parsed.get("usage") {
            if let Some(n) = usage.get("prompt_tokens").and_then(Value::as_u64) {
                acc.tokens_in = n as u32;
            }
            if let Some(n) = usage.get("completion_tokens").and_then(Value::as_u64) {
                acc.tokens_out = n as u32;
            }
        }
        return Ok(false);
    };

    if let Some(text) = delta.get("content").and_then(Value::as_str) {
        acc.text.push_str(text);
        let _ = chunk_tx.send(StreamChunk::TextDelta {
            text: text.to_string(),
        });
    }

    Ok(false)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::sync::mpsc;

    fn bare(data: &str) -> SseEvent {
        SseEvent {
            event_type: None,
            data: data.to_string(),
        }
    }

    /// A realistic response: two content deltas, a final usage-only chunk
    /// (the shape you only get with `stream_options.include_usage`), then
    /// the `[DONE]` sentinel.
    fn fixture_events() -> Vec<SseEvent> {
        vec![
            bare(r#"{"choices":[{"delta":{"content":"Here is "}}]}"#),
            bare(r#"{"choices":[{"delta":{"content":"your diagram."}}]}"#),
            bare(r#"{"choices":[],"usage":{"prompt_tokens":30,"completion_tokens":9}}"#),
            bare("[DONE]"),
        ]
    }

    #[test]
    fn accumulates_text_and_stops_on_done_sentinel() {
        let (tx, mut rx) = mpsc::unbounded_channel();
        let mut acc = Accumulator::default();

        let mut stopped = false;
        for event in fixture_events() {
            if apply_event(&event, &mut acc, &tx, "sk-test").unwrap() {
                stopped = true;
                break;
            }
        }

        assert!(stopped);
        assert_eq!(acc.text, "Here is your diagram.");
        assert_eq!(acc.tokens_in, 30);
        assert_eq!(acc.tokens_out, 9);

        drop(tx);
        let mut deltas = Vec::new();
        while let Ok(StreamChunk::TextDelta { text }) = rx.try_recv() {
            deltas.push(text);
        }
        assert_eq!(deltas, vec!["Here is ", "your diagram."]);
    }

    #[test]
    fn usage_defaults_to_zero_when_the_server_never_sends_it() {
        let (tx, _rx) = mpsc::unbounded_channel();
        let mut acc = Accumulator::default();
        for event in [
            bare(r#"{"choices":[{"delta":{"content":"hi"}}]}"#),
            bare("[DONE]"),
        ] {
            apply_event(&event, &mut acc, &tx, "k").unwrap();
        }
        assert_eq!(acc.tokens_in, 0);
        assert_eq!(acc.tokens_out, 0);
    }

    #[test]
    fn inline_error_object_is_redacted_and_returned() {
        let (tx, mut rx) = mpsc::unbounded_channel();
        let mut acc = Accumulator::default();
        let event = bare(r#"{"error":{"message":"invalid key sk-live-secret"}}"#);

        let err = apply_event(&event, &mut acc, &tx, "sk-live-secret").unwrap_err();
        assert!(!err.to_string().contains("sk-live-secret"));

        let StreamChunk::Error { message } = rx.try_recv().unwrap() else {
            panic!("expected an Error chunk");
        };
        assert!(!message.contains("sk-live-secret"));
    }

    #[test]
    fn malformed_json_surfaces_as_a_stream_error() {
        let (tx, _rx) = mpsc::unbounded_channel();
        let mut acc = Accumulator::default();
        let event = bare("{not valid json");
        let err = apply_event(&event, &mut acc, &tx, "k").unwrap_err();
        assert!(matches!(err, AiError::Stream(_)));
    }
}
