// Newline-delimited JSON framing — Ollama's native `/api/chat` streams one
// complete JSON object per line, with no `event:`/`data:` fields and no
// blank-line boundaries. Not SSE, hence its own tiny parser rather than
// reusing `sse.rs`.

/// Incremental line splitter over a byte buffer. Same byte-buffering
/// rationale as `sse::SseParser`: a network read can split a line — and a
/// multi-byte UTF-8 character within it — at an arbitrary byte offset, so
/// decoding is deferred until a complete `\n`-terminated line is in hand.
#[derive(Default)]
pub struct NdjsonParser {
    buffer: Vec<u8>,
}

impl NdjsonParser {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn push(&mut self, bytes: &[u8]) {
        self.buffer.extend_from_slice(bytes);
    }

    /// Pops the next complete line out of the buffer, if one is available.
    /// Blank lines (Ollama doesn't emit them, but a stray keep-alive
    /// newline shouldn't break the parser) are skipped rather than
    /// returned as `Some("")`.
    pub fn pop_line(&mut self) -> Option<String> {
        loop {
            let pos = self.buffer.iter().position(|&b| b == b'\n')?;
            let raw: Vec<u8> = self.buffer.drain(..=pos).collect();
            let line = String::from_utf8_lossy(&raw[..raw.len() - 1]);
            let trimmed = line.trim();
            if !trimmed.is_empty() {
                return Some(trimmed.to_string());
            }
            // Blank line — loop to look for the next one already in the
            // buffer instead of returning `None` and making the caller
            // re-poll for data that's already here.
        }
    }

    /// Consumes the parser to recover a final line with no trailing `\n` —
    /// Ollama always terminates its last line, but a truncated connection
    /// shouldn't silently drop a `done: true` chunk that did arrive.
    pub fn finish(self) -> Option<String> {
        let trimmed = String::from_utf8_lossy(&self.buffer).trim().to_string();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pops_complete_lines_only() {
        let mut p = NdjsonParser::new();
        p.push(b"{\"a\":1}\n{\"b\":2}\n{\"c\":");
        assert_eq!(p.pop_line().unwrap(), "{\"a\":1}");
        assert_eq!(p.pop_line().unwrap(), "{\"b\":2}");
        assert!(p.pop_line().is_none());
    }

    #[test]
    fn skips_blank_lines() {
        let mut p = NdjsonParser::new();
        p.push(b"\n\n{\"a\":1}\n");
        assert_eq!(p.pop_line().unwrap(), "{\"a\":1}");
    }

    #[test]
    fn recovers_final_line_without_trailing_newline() {
        let mut p = NdjsonParser::new();
        p.push(b"{\"done\":true}");
        assert!(p.pop_line().is_none());
        assert_eq!(p.finish().unwrap(), "{\"done\":true}");
    }

    #[test]
    fn finish_on_empty_buffer_yields_none() {
        assert!(NdjsonParser::new().finish().is_none());
    }

    #[test]
    fn a_multibyte_utf8_character_split_across_two_chunks_survives() {
        let full = "{\"content\":\"caf\u{e9}\"}\n".as_bytes().to_vec();
        let split_at = full
            .windows(2)
            .position(|w| w == [0xC3, 0xA9])
            .map(|i| i + 1)
            .unwrap();
        let (first, second) = full.split_at(split_at);

        let mut p = NdjsonParser::new();
        p.push(first);
        assert!(p.pop_line().is_none());
        p.push(second);
        assert_eq!(p.pop_line().unwrap(), "{\"content\":\"café\"}");
    }
}
