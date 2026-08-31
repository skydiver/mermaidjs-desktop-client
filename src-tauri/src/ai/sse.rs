// Server-Sent Events framing — shared by any provider whose wire format is
// SSE (Anthropic and OpenAI; Ollama is NDJSON and uses `ndjson.rs` instead).
//
// This is deliberately just the framing layer: splitting bytes into
// `event:`/`data:` fields on blank-line boundaries. What the `data:` JSON
// *means* — Anthropic's named events vs. OpenAI's bare deltas — is entirely
// the calling provider module's problem.

use bytes::Bytes;
use futures::{Stream, StreamExt};
use std::pin::Pin;

use super::AiError;

/// One parsed SSE event.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SseEvent {
    /// The `event:` field, if the server sent one. Anthropic always does
    /// (`message_start`, `content_block_delta`, ...); OpenAI never does —
    /// every OpenAI event has `event_type: None` and the payload is read
    /// straight out of `data`.
    pub event_type: Option<String>,
    /// The `data:` field. Multiple `data:` lines in one event are joined
    /// with `\n`, per the SSE spec.
    pub data: String,
}

/// Incremental SSE parser over a byte buffer. Kept separate from any async
/// I/O so it can be driven directly in tests with hand-built byte chunks —
/// including chunks that split a multi-byte UTF-8 character, which a
/// network read can absolutely do mid-stream.
#[derive(Default)]
pub struct SseParser {
    buffer: Vec<u8>,
}

impl SseParser {
    pub fn new() -> Self {
        Self::default()
    }

    /// Feeds newly-received bytes in. Bytes are appended as raw bytes, not
    /// decoded — decoding happens only once a full line is available (see
    /// `pop_event`). A newline byte can never appear inside a UTF-8
    /// continuation byte (those are always `>= 0x80`), so once we do split
    /// on `\n` the resulting pieces are safe to decode even if the
    /// original network chunk boundary fell mid-character.
    pub fn push(&mut self, bytes: &[u8]) {
        self.buffer.extend_from_slice(bytes);
        normalize_crlf(&mut self.buffer);
    }

    /// Pops the next complete event (terminated by a blank line) out of the
    /// buffer, if one is available yet.
    pub fn pop_event(&mut self) -> Option<SseEvent> {
        let boundary = find(&self.buffer, b"\n\n")?;
        let raw: Vec<u8> = self.buffer.drain(..boundary + 2).collect();
        parse_raw_event(&raw[..raw.len() - 2])
    }

    /// Consumes the parser to recover a trailing event that never got a
    /// closing blank line — some servers close the connection immediately
    /// after their last `data:` line instead of sending one. Returns
    /// `None` if only whitespace (or nothing) is left.
    pub fn finish(self) -> Option<SseEvent> {
        if self.buffer.iter().all(u8::is_ascii_whitespace) {
            None
        } else {
            parse_raw_event(&self.buffer)
        }
    }
}

/// Rewrites any `\r\n` in `buf` to `\n` in place. Run after every `push` so
/// the rest of the parser only ever has to reason about `\n`. Safe to run
/// on the whole buffer repeatedly: bytes already normalized contain no
/// `\r`, so re-running is a no-op scan over them. A lone trailing `\r` with
/// its `\n` not yet arrived is left as `\r` and picked up correctly on the
/// next `push`, once the buffer holds both bytes together.
fn normalize_crlf(buf: &mut Vec<u8>) {
    if !buf.contains(&b'\r') {
        return;
    }
    let mut out = Vec::with_capacity(buf.len());
    let mut i = 0;
    while i < buf.len() {
        if buf[i] == b'\r' && buf.get(i + 1) == Some(&b'\n') {
            out.push(b'\n');
            i += 2;
        } else {
            out.push(buf[i]);
            i += 1;
        }
    }
    *buf = out;
}

fn find(haystack: &[u8], needle: &[u8]) -> Option<usize> {
    haystack
        .windows(needle.len())
        .position(|window| window == needle)
}

fn parse_raw_event(raw: &[u8]) -> Option<SseEvent> {
    // `raw` was split on `\n` boundaries in `push`/`pop_event`, which are
    // never valid mid-character, so this is always a complete decode.
    let text = String::from_utf8_lossy(raw);

    let mut event_type: Option<String> = None;
    let mut data_lines: Vec<String> = Vec::new();

    for line in text.split('\n') {
        if line.starts_with(':') {
            continue; // comment line
        } else if let Some(value) = line.strip_prefix("event:") {
            event_type = Some(value.trim().to_string());
        } else if let Some(value) = line.strip_prefix("data:") {
            // Only the single leading space the spec puts after the colon
            // is stripped — anything past that is data.
            data_lines.push(value.strip_prefix(' ').unwrap_or(value).to_string());
        }
        // `id:`, `retry:`, and unrecognized fields carry nothing this app
        // needs and are dropped.
    }

    if data_lines.is_empty() && event_type.is_none() {
        return None;
    }

    Some(SseEvent {
        event_type,
        data: data_lines.join("\n"),
    })
}

/// An SSE response, ready to be pulled one event at a time.
pub struct SseStream {
    parser: SseParser,
    body: Pin<Box<dyn Stream<Item = Result<Bytes, reqwest::Error>> + Send>>,
    body_ended: bool,
    final_event_checked: bool,
}

impl SseStream {
    /// Returns the next event, or `None` once the stream is fully drained
    /// (including the one-shot trailing-event recovery on end-of-stream).
    pub async fn next(&mut self) -> Result<Option<SseEvent>, AiError> {
        loop {
            if let Some(event) = self.parser.pop_event() {
                return Ok(Some(event));
            }

            if self.body_ended {
                if self.final_event_checked {
                    return Ok(None);
                }
                self.final_event_checked = true;
                let parser = std::mem::take(&mut self.parser);
                return Ok(parser.finish());
            }

            match self.body.next().await {
                Some(Ok(bytes)) => self.parser.push(&bytes),
                Some(Err(e)) => return Err(AiError::Stream(e.to_string())),
                None => self.body_ended = true,
            }
        }
    }
}

/// Validates the response status and, on success, wraps its body as an
/// [`SseStream`]. Non-2xx bodies are read in full (never streamed) and
/// classified: 401 → `Auth`, 429 → `RateLimited` (using `retry-after` if
/// present), anything else → `Request`. `api_key`, if given, is redacted
/// out of the error body before it's returned — see `redact`.
pub async fn open_sse(response: reqwest::Response, api_key: Option<&str>) -> Result<SseStream, AiError> {
    let status = response.status();
    let retry_after = response
        .headers()
        .get("retry-after")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.parse::<u64>().ok());

    if !status.is_success() {
        let body = response
            .text()
            .await
            .unwrap_or_else(|_| "(failed to read error body)".into());
        let body = match api_key {
            Some(key) => super::redact(&body, key),
            None => body,
        };

        // The provider's own sentence when it gave one, otherwise the status
        // plus the raw body so nothing is lost when the shape is unfamiliar.
        let message = super::provider_message(&body);

        return Err(match status.as_u16() {
            401 => AiError::Auth(match message {
                Some(message) => format!("Authentication failed: {message}"),
                None => format!("Authentication failed: {body}"),
            }),
            429 => AiError::RateLimited {
                retry_after_secs: retry_after.unwrap_or(60),
            },
            code => AiError::Request(match message {
                Some(message) => message,
                None => format!("HTTP {code} — {body}"),
            }),
        });
    }

    Ok(SseStream {
        parser: SseParser::new(),
        body: Box::pin(response.bytes_stream()),
        body_ended: false,
        final_event_checked: false,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_single_data_line() {
        let mut p = SseParser::new();
        p.push(b"data: hello\n\n");
        let event = p.pop_event().unwrap();
        assert_eq!(event.data, "hello");
        assert_eq!(event.event_type, None);
    }

    #[test]
    fn parses_named_event_with_data() {
        let mut p = SseParser::new();
        p.push(b"event: message_start\ndata: {\"a\":1}\n\n");
        let event = p.pop_event().unwrap();
        assert_eq!(event.event_type.as_deref(), Some("message_start"));
        assert_eq!(event.data, "{\"a\":1}");
    }

    #[test]
    fn joins_multiple_data_lines_with_newline() {
        let mut p = SseParser::new();
        p.push(b"data: line one\ndata: line two\n\n");
        let event = p.pop_event().unwrap();
        assert_eq!(event.data, "line one\nline two");
    }

    #[test]
    fn ignores_comment_lines() {
        let mut p = SseParser::new();
        p.push(b": keep-alive comment\ndata: real data\n\n");
        let event = p.pop_event().unwrap();
        assert_eq!(event.data, "real data");
    }

    #[test]
    fn ignores_id_and_retry_fields() {
        let mut p = SseParser::new();
        p.push(b"id: 42\nretry: 3000\ndata: payload\n\n");
        let event = p.pop_event().unwrap();
        assert_eq!(event.data, "payload");
    }

    #[test]
    fn yields_events_in_order_and_then_none() {
        let mut p = SseParser::new();
        p.push(b"data: first\n\ndata: second\n\n");
        assert_eq!(p.pop_event().unwrap().data, "first");
        assert_eq!(p.pop_event().unwrap().data, "second");
        assert!(p.pop_event().is_none());
    }

    #[test]
    fn handles_crlf_line_endings() {
        let mut p = SseParser::new();
        p.push(b"event: message_start\r\ndata: {\"x\":1}\r\n\r\n");
        let event = p.pop_event().unwrap();
        assert_eq!(event.event_type.as_deref(), Some("message_start"));
        assert_eq!(event.data, "{\"x\":1}");
    }

    #[test]
    fn handles_crlf_boundary_split_across_two_pushes() {
        // The `\r` and `\n` of the terminating CRLFCRLF arrive in separate
        // chunks — normalize_crlf must not corrupt or drop the boundary.
        let mut p = SseParser::new();
        p.push(b"data: value\r");
        p.push(b"\n\r\n");
        let event = p.pop_event().unwrap();
        assert_eq!(event.data, "value");
    }

    #[test]
    fn recovers_trailing_event_with_no_blank_line_at_stream_end() {
        let mut p = SseParser::new();
        p.push(b"data: last one, no trailing blank line");
        assert!(p.pop_event().is_none()); // not yet — no boundary
        let event = p.finish().unwrap();
        assert_eq!(event.data, "last one, no trailing blank line");
    }

    #[test]
    fn finish_on_empty_or_whitespace_buffer_yields_none() {
        assert!(SseParser::new().finish().is_none());
        let mut p = SseParser::new();
        p.push(b"   \n  ");
        assert!(p.finish().is_none());
    }

    #[test]
    fn a_multibyte_utf8_character_split_across_two_chunks_survives() {
        // "café" — the é is the two bytes 0xC3 0xA9. Split the push right
        // between them, mimicking a network read boundary landing
        // mid-character. Immediately decoding each chunk independently (as
        // opposed to buffering raw bytes and decoding whole lines only)
        // would corrupt this into replacement characters.
        let full = "data: caf\u{e9}\n\n".as_bytes().to_vec();
        let split_at = full
            .windows(2)
            .position(|w| w == [0xC3, 0xA9])
            .map(|i| i + 1)
            .unwrap();
        let (first, second) = full.split_at(split_at);

        let mut p = SseParser::new();
        p.push(first);
        assert!(p.pop_event().is_none());
        p.push(second);
        let event = p.pop_event().unwrap();
        assert_eq!(event.data, "café");
    }

    #[test]
    fn open_sse_maps_401_to_auth_and_redacts_key() {
        // `open_sse` needs a real `reqwest::Response`, which needs a real
        // HTTP exchange — exercised via a tiny local server rather than
        // hand-building a `Response` (reqwest offers no public constructor
        // for one). Kept in this module rather than an integration test
        // file since it's testing this module's own status-mapping logic.
        let rt = tokio::runtime::Runtime::new().unwrap();
        rt.block_on(async {
            let server = httpmock_401_with_key();
            let response = reqwest::get(server).await.unwrap();
            let Err(err) = open_sse(response, Some("sk-secret")).await else {
                panic!("expected open_sse to return an error for a 401 response");
            };
            let message = err.to_string();
            assert!(matches!(err, AiError::Auth(_)));
            assert!(!message.contains("sk-secret"));
            assert!(message.contains("[REDACTED]"));
        });
    }

    /// Spins up a one-shot local HTTP server returning 401 with the given
    /// key echoed in the body, and returns its URL. Avoids pulling in a
    /// mocking crate for a single test.
    fn httpmock_401_with_key() -> String {
        use std::io::{Read, Write};
        use std::net::TcpListener;

        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let addr = listener.local_addr().unwrap();

        std::thread::spawn(move || {
            if let Ok((mut stream, _)) = listener.accept() {
                let mut buf = [0u8; 1024];
                let _ = stream.read(&mut buf);
                let body = "{\"error\":\"bad key sk-secret\"}";
                let response = format!(
                    "HTTP/1.1 401 Unauthorized\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                    body.len(),
                    body
                );
                let _ = stream.write_all(response.as_bytes());
            }
        });

        format!("http://{addr}/")
    }
}
