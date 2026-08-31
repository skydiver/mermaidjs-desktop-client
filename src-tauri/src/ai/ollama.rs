// Ollama — local models via the native `/api/chat` endpoint, streamed as
// newline-delimited JSON (see `ndjson.rs`; this is NOT Server-Sent Events).
//
// No API key: Ollama is a local service with no auth concept, so this is
// the only provider module that never touches the keychain.
//
// Wire format notes:
// - Every line is a complete JSON object with a `message` field carrying
//   incremental `content`. The final line additionally has `"done": true`
//   plus `prompt_eval_count` / `eval_count` — Ollama's names for input and
//   output token counts, only present on that last line.
// - A non-2xx status is returned as a single plain-text (not JSON) body,
//   unlike the JSON error envelopes the SSE providers use — handled
//   directly here rather than through `sse::open_sse`, which assumes SSE
//   framing on success.

use futures::StreamExt;
use reqwest::Client;
use serde_json::{json, Value};
use tokio::sync::mpsc::UnboundedSender;

use super::ndjson::NdjsonParser;
use super::{AiError, AiResponse, Message, StreamChunk};

pub async fn send(
    client: &Client,
    base_url: &str,
    model: &str,
    messages: &[Message],
    chunk_tx: &UnboundedSender<StreamChunk>,
) -> Result<AiResponse, AiError> {
    let url = endpoint(base_url);

    let response = client
        .post(&url)
        .json(&build_request_body(messages, model))
        .send()
        .await
        .map_err(|e| AiError::Request(format!("Failed to connect to Ollama at {base_url}: {e}")))?;

    let status = response.status();
    if !status.is_success() {
        let body = response
            .text()
            .await
            .unwrap_or_else(|_| "(failed to read error body)".into());
        return Err(AiError::Request(format!("HTTP {} — {body}", status.as_u16())));
    }

    let mut byte_stream = response.bytes_stream();
    let mut parser = NdjsonParser::new();
    let mut acc = Accumulator::default();

    loop {
        while let Some(line) = parser.pop_line() {
            if apply_line(&line, &mut acc, chunk_tx)? {
                return Ok(acc.into());
            }
        }

        match byte_stream.next().await {
            Some(Ok(bytes)) => parser.push(&bytes),
            Some(Err(e)) => return Err(AiError::Stream(e.to_string())),
            None => {
                if let Some(line) = parser.finish() {
                    apply_line(&line, &mut acc, chunk_tx)?;
                }
                return Ok(acc.into());
            }
        }
    }
}

/// Ollama's native chat endpoint — as opposed to `/v1/chat/completions`,
/// which Ollama also exposes for OpenAI-client compatibility but which
/// doesn't report `prompt_eval_count`/`eval_count` the same way.
fn endpoint(base_url: &str) -> String {
    format!("{}/api/chat", base_url.trim_end_matches('/'))
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

/// Folds one NDJSON line into `acc`. Returns `Ok(true)` once `"done":
/// true` is seen — the signal to stop reading — `Ok(false)` otherwise, or
/// `Err` if the line carried Ollama's `error` field (Ollama reports
/// mid-stream failures, like the model being unloaded, this way rather
/// than by closing the connection).
///
/// Pulled out of `send`'s loop so it can be driven directly from a fixture
/// line sequence in tests, without a live HTTP stream.
fn apply_line(
    line: &str,
    acc: &mut Accumulator,
    chunk_tx: &UnboundedSender<StreamChunk>,
) -> Result<bool, AiError> {
    let parsed: Value = match serde_json::from_str(line) {
        Ok(v) => v,
        Err(_) => return Ok(false), // skip a malformed line rather than aborting the whole response
    };

    if let Some(err) = parsed.get("error") {
        let message = err.as_str().unwrap_or("Ollama error").to_string();
        let _ = chunk_tx.send(StreamChunk::Error {
            message: message.clone(),
        });
        return Err(AiError::Request(message));
    }

    if let Some(content) = parsed
        .pointer("/message/content")
        .and_then(Value::as_str)
        .filter(|s| !s.is_empty())
    {
        acc.text.push_str(content);
        let _ = chunk_tx.send(StreamChunk::TextDelta {
            text: content.to_string(),
        });
    }

    if parsed.get("done").and_then(Value::as_bool) == Some(true) {
        if let Some(n) = parsed.get("prompt_eval_count").and_then(Value::as_u64) {
            acc.tokens_in = n as u32;
        }
        if let Some(n) = parsed.get("eval_count").and_then(Value::as_u64) {
            acc.tokens_out = n as u32;
        }
        return Ok(true);
    }

    Ok(false)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::sync::mpsc;

    fn fixture_lines() -> Vec<&'static str> {
        vec![
            r#"{"message":{"content":"Here is "},"done":false}"#,
            r#"{"message":{"content":"your diagram."},"done":false}"#,
            r#"{"message":{"content":""},"done":true,"prompt_eval_count":18,"eval_count":6}"#,
        ]
    }

    #[test]
    fn accumulates_text_and_stops_on_done_true() {
        let (tx, mut rx) = mpsc::unbounded_channel();
        let mut acc = Accumulator::default();

        let mut stopped = false;
        for line in fixture_lines() {
            if apply_line(line, &mut acc, &tx).unwrap() {
                stopped = true;
                break;
            }
        }

        assert!(stopped);
        assert_eq!(acc.text, "Here is your diagram.");
        assert_eq!(acc.tokens_in, 18);
        assert_eq!(acc.tokens_out, 6);

        drop(tx);
        let mut deltas = Vec::new();
        while let Ok(StreamChunk::TextDelta { text }) = rx.try_recv() {
            deltas.push(text);
        }
        assert_eq!(deltas, vec!["Here is ", "your diagram."]);
    }

    #[test]
    fn error_field_is_returned_as_an_error() {
        let (tx, mut rx) = mpsc::unbounded_channel();
        let mut acc = Accumulator::default();
        let err = apply_line(r#"{"error":"model not found"}"#, &mut acc, &tx).unwrap_err();
        assert!(matches!(err, AiError::Request(_)));
        let StreamChunk::Error { message } = rx.try_recv().unwrap() else {
            panic!("expected an Error chunk");
        };
        assert_eq!(message, "model not found");
    }

    #[test]
    fn malformed_line_is_skipped_not_fatal() {
        let (tx, _rx) = mpsc::unbounded_channel();
        let mut acc = Accumulator::default();
        assert!(!apply_line("not json at all", &mut acc, &tx).unwrap());
    }

    #[test]
    fn endpoint_strips_trailing_slash() {
        assert_eq!(endpoint("http://localhost:11434/"), "http://localhost:11434/api/chat");
        assert_eq!(endpoint("http://localhost:11434"), "http://localhost:11434/api/chat");
    }
}
