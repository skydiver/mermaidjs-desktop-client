// Anthropic Claude — Messages API, streamed over SSE.
//
// Wire format notes (from Anthropic's streaming docs, as of this writing):
// - A response is a sequence of *named* SSE events, unlike OpenAI's bare
//   `data:` lines: `message_start` → repeated `content_block_start` /
//   `content_block_delta` / `content_block_stop` → `message_delta` →
//   `message_stop`, with `ping` events interleaved as keep-alives.
// - Input token count is only available on `message_start`
//   (`message.usage.input_tokens`); output token count only becomes known
//   on `message_delta` (`usage.output_tokens`), once generation is
//   essentially done. There is no single event carrying both.
// - Streaming errors can arrive as an `error` named event *after* a 200
//   response has already started (as opposed to a non-2xx status, which
//   `sse::open_sse` already turns into an `Err` before we get here).

use reqwest::Client;
use serde_json::{json, Value};
use tokio::sync::mpsc::UnboundedSender;

use super::sse::{open_sse, SseEvent};
use super::{redact, AiError, AiResponse, Message, StreamChunk};
use crate::keyring;

const API_URL: &str = "https://api.anthropic.com/v1/messages";
const API_VERSION: &str = "2023-06-01";

/// Anthropic requires `max_tokens`; there's no "let the model decide"
/// option. 4096 comfortably covers a Mermaid diagram plus a short
/// explanation without being large enough to make a runaway response slow.
const MAX_TOKENS: u32 = 4096;

pub async fn send(
    client: &Client,
    model: &str,
    messages: &[Message],
    chunk_tx: &UnboundedSender<StreamChunk>,
) -> Result<AiResponse, AiError> {
    let api_key = keyring::get_api_key("anthropic")
        .map_err(AiError::Request)?
        .ok_or_else(|| {
            AiError::Auth("No Anthropic API key stored — add one in Settings".into())
        })?;

    let response = client
        .post(API_URL)
        .header("x-api-key", &api_key)
        .header("anthropic-version", API_VERSION)
        .json(&build_request_body(messages, model))
        .send()
        .await
        .map_err(|e| AiError::Request(e.to_string()))?;

    let mut stream = open_sse(response, Some(&api_key)).await?;
    let mut acc = Accumulator::default();

    while let Some(event) = stream.next().await? {
        if apply_event(&event, &mut acc, chunk_tx, &api_key)? {
            break; // message_stop
        }
    }

    Ok(acc.into())
}

fn build_request_body(messages: &[Message], model: &str) -> Value {
    let mut system_text: Option<String> = None;
    let mut api_messages: Vec<Value> = Vec::new();

    for message in messages {
        match message {
            Message::System { content } => system_text = Some(content.clone()),
            Message::User { content } => {
                api_messages.push(json!({ "role": "user", "content": content }));
            }
            Message::Assistant { content } => {
                api_messages.push(json!({ "role": "assistant", "content": content }));
            }
        }
    }

    let mut body = json!({
        "model": model,
        "max_tokens": MAX_TOKENS,
        "stream": true,
        "messages": api_messages,
    });
    if let Some(system) = system_text {
        body["system"] = json!(system);
    }
    body
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

/// Folds one parsed SSE event into `acc`, forwarding any new text through
/// `chunk_tx`. Returns `Ok(true)` on `message_stop` — the signal to stop
/// reading — `Ok(false)` for every other recognized or ignored event type,
/// and `Err` if the event itself was a mid-stream `error`.
///
/// Pulled out of `send`'s loop so it can be driven directly from a fixture
/// event sequence in tests, without a live HTTP stream.
fn apply_event(
    event: &SseEvent,
    acc: &mut Accumulator,
    chunk_tx: &UnboundedSender<StreamChunk>,
    api_key: &str,
) -> Result<bool, AiError> {
    if event.data.is_empty() {
        return Ok(false);
    }

    match event.event_type.as_deref().unwrap_or("") {
        "message_start" => {
            if let Ok(v) = serde_json::from_str::<Value>(&event.data) {
                if let Some(n) = v
                    .pointer("/message/usage/input_tokens")
                    .and_then(Value::as_u64)
                {
                    acc.tokens_in = n as u32;
                }
            }
            Ok(false)
        }

        "content_block_delta" => {
            if let Ok(v) = serde_json::from_str::<Value>(&event.data) {
                if v.pointer("/delta/type").and_then(Value::as_str) == Some("text_delta") {
                    if let Some(text) = v.pointer("/delta/text").and_then(Value::as_str) {
                        acc.text.push_str(text);
                        let _ = chunk_tx.send(StreamChunk::TextDelta {
                            text: text.to_string(),
                        });
                    }
                }
            }
            Ok(false)
        }

        "message_delta" => {
            if let Ok(v) = serde_json::from_str::<Value>(&event.data) {
                if let Some(n) = v.pointer("/usage/output_tokens").and_then(Value::as_u64) {
                    acc.tokens_out = n as u32;
                }
            }
            Ok(false)
        }

        "message_stop" => Ok(true),

        "error" => {
            let raw_message = serde_json::from_str::<Value>(&event.data)
                .ok()
                .and_then(|v| {
                    v.pointer("/error/message")
                        .and_then(Value::as_str)
                        .map(String::from)
                })
                .unwrap_or_else(|| event.data.clone());
            let message = redact(&raw_message, api_key);
            let _ = chunk_tx.send(StreamChunk::Error {
                message: message.clone(),
            });
            Err(AiError::Request(message))
        }

        // `ping` (keep-alive) and `content_block_start`/`content_block_stop`
        // (block framing) carry nothing this app accumulates.
        _ => Ok(false),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::sync::mpsc;

    fn named(event_type: &str, data: &str) -> SseEvent {
        SseEvent {
            event_type: Some(event_type.to_string()),
            data: data.to_string(),
        }
    }

    /// A realistic full response: message_start with input tokens, a text
    /// block streamed in two deltas, a `ping` interleaved (must be
    /// ignored), block/message framing, and message_delta carrying output
    /// tokens before message_stop ends the response.
    fn fixture_events() -> Vec<SseEvent> {
        vec![
            named(
                "message_start",
                r#"{"message":{"usage":{"input_tokens":42}}}"#,
            ),
            named(
                "content_block_start",
                r#"{"content_block":{"type":"text"}}"#,
            ),
            named(
                "content_block_delta",
                r#"{"delta":{"type":"text_delta","text":"Here is "}}"#,
            ),
            named("ping", "{}"),
            named(
                "content_block_delta",
                r#"{"delta":{"type":"text_delta","text":"your diagram."}}"#,
            ),
            named("content_block_stop", "{}"),
            named("message_delta", r#"{"usage":{"output_tokens":7}}"#),
            named("message_stop", "{}"),
        ]
    }

    #[test]
    fn accumulates_text_and_token_counts_across_the_full_sequence() {
        let (tx, mut rx) = mpsc::unbounded_channel();
        let mut acc = Accumulator::default();

        let mut stopped = false;
        for event in fixture_events() {
            if apply_event(&event, &mut acc, &tx, "sk-test").unwrap() {
                stopped = true;
                break;
            }
        }

        assert!(stopped, "message_stop should signal the loop to stop");
        assert_eq!(acc.text, "Here is your diagram.");
        assert_eq!(acc.tokens_in, 42);
        assert_eq!(acc.tokens_out, 7);

        drop(tx);
        let mut deltas = Vec::new();
        while let Ok(chunk) = rx.try_recv() {
            if let StreamChunk::TextDelta { text } = chunk {
                deltas.push(text);
            }
        }
        assert_eq!(deltas, vec!["Here is ", "your diagram."]);
    }

    #[test]
    fn mid_stream_error_event_is_redacted_and_returned() {
        let (tx, mut rx) = mpsc::unbounded_channel();
        let mut acc = Accumulator::default();
        let event = named(
            "error",
            r#"{"error":{"message":"invalid key sk-live-secret"}}"#,
        );

        let err = apply_event(&event, &mut acc, &tx, "sk-live-secret").unwrap_err();
        let message = err.to_string();
        assert!(!message.contains("sk-live-secret"));
        assert!(message.contains("[REDACTED]"));

        let StreamChunk::Error { message: emitted } = rx.try_recv().unwrap() else {
            panic!("expected an Error chunk");
        };
        assert!(!emitted.contains("sk-live-secret"));
    }

    #[test]
    fn events_with_empty_data_are_ignored() {
        let (tx, _rx) = mpsc::unbounded_channel();
        let mut acc = Accumulator::default();
        let event = SseEvent {
            event_type: Some("ping".to_string()),
            data: String::new(),
        };
        assert!(!apply_event(&event, &mut acc, &tx, "k").unwrap());
        assert_eq!(acc.text, "");
    }
}
