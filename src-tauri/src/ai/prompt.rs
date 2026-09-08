// System prompt — single source of truth for how the AI assistant behaves.
//
// Centralized here (rather than inlined in `commands/ai.rs`) so the prompt
// text and the wording contract it establishes — "at most one fenced
// ```mermaid block, always the complete diagram, never a diff" — has one
// place to be read, reviewed and tested independently of the command
// plumbing that sends it.

/// The system prompt prepended to every conversation sent to a provider.
/// Rust owns this — the frontend never sends a system message (see
/// `commands/ai.rs::send_ai_message`), so this is the only place the
/// assistant's behavior contract is defined.
pub fn system_prompt() -> &'static str {
    "You are a Mermaid diagram assistant embedded in a desktop Mermaid \
     editor. The user is looking at a live preview of the Mermaid source \
     shown to you below as \"Current diagram source\".\n\
     \n\
     When you reply, follow these rules:\n\
     - If the user's request needs a new or changed diagram, respond with \
     a short natural-language explanation followed by exactly ONE fenced \
     code block labeled `mermaid` (```mermaid ... ```) containing the \
     COMPLETE diagram source — never a partial diff, patch, or a snippet \
     that only shows the changed lines. The editor replaces its entire \
     contents with that block, so anything you omit from it is lost.\n\
     - Never include more than one ```mermaid code block in a single \
     reply.\n\
     - If the user asks a question that doesn't require changing the \
     diagram (e.g. asking what a piece of syntax means), reply in plain \
     text with no code block at all.\n\
     - Keep the natural-language explanation brief; the diagram itself is \
     the primary output when one is included."
}

/// Composes the text of a user turn, embedding the current editor contents
/// so the model always has the diagram it should be editing in context.
/// Called once, on the *latest* user message only — `commands/ai.rs` sends
/// earlier turns as plain text, matching what the assistant actually said
/// and was shown at the time.
pub fn compose_user_turn(user_message: &str, diagram_source: &str) -> String {
    let diagram_section = if diagram_source.trim().is_empty() {
        "Current diagram source: (the editor is currently empty — there is no diagram yet).".to_string()
    } else {
        format!(
            "Current diagram source:\n```mermaid\n{}\n```",
            diagram_source
        )
    };

    format!("{diagram_section}\n\n{user_message}")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn system_prompt_requires_exactly_one_mermaid_block_and_full_source() {
        let prompt = system_prompt();
        assert!(prompt.contains("```mermaid"));
        assert!(prompt.contains("ONE fenced"));
        assert!(prompt.to_lowercase().contains("never a partial diff"));
        assert!(prompt.to_lowercase().contains("complete diagram"));
    }

    #[test]
    fn compose_user_turn_embeds_diagram_source() {
        let composed = compose_user_turn("make it red", "graph TD; A-->B;");
        assert!(composed.contains("```mermaid\ngraph TD; A-->B;\n```"));
        assert!(composed.ends_with("make it red"));
    }

    #[test]
    fn compose_user_turn_notes_empty_editor() {
        let composed = compose_user_turn("start a flowchart", "");
        assert!(composed.contains("editor is currently empty"));
        assert!(!composed.contains("```mermaid"));
        assert!(composed.ends_with("start a flowchart"));
    }

    #[test]
    fn compose_user_turn_treats_whitespace_only_source_as_empty() {
        let composed = compose_user_turn("hello", "   \n  ");
        assert!(composed.contains("editor is currently empty"));
    }
}
