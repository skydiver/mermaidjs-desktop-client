import type { StringStream } from '@codemirror/language';
import { StreamLanguage } from '@codemirror/language';
import type { Extension } from '@codemirror/state';

const MERMAID_KEYWORDS = [
  'graph',
  'flowchart',
  'sequenceDiagram',
  'classDiagram',
  'stateDiagram',
  'erDiagram',
  'journey',
  'gantt',
  'pie',
  'mindmap',
  'timeline',
  'gitGraph',
  'quadrantChart',
  'requirementDiagram',
  'subgraph',
  'end',
  'click',
  'linkStyle',
  'style',
  'class',
  'direction',
  'tb',
  'td',
  'lr',
  'rl',
  'bt',
  'note',
  'rect',
  'call',
  'section',
  'loop',
  'alt',
  'opt',
  'par',
  'and',
] as const;

export type MermaidKeyword = (typeof MERMAID_KEYWORDS)[number];

const ARROW_TOKENS = ['-.->', '-->', '<--', '==>', '<==', '.->', '->', '<-', '=='];

export function createMermaidLanguage(): Extension {
  const keywordSet = new Set(MERMAID_KEYWORDS.map((word: MermaidKeyword) => word.toLowerCase()));
  const operatorPattern = /[-+*/=<>!]+/;

  return StreamLanguage.define({
    token(stream: StringStream) {
      if (stream.eatSpace()) return null;

      if (stream.match('%%')) {
        stream.skipToEnd();
        return 'comment';
      }

      const next = stream.peek();
      if (next === '"' || next === "'") {
        stream.next();
        readQuoted(stream, next);
        return 'string';
      }

      if (stream.match(/[#.][A-Za-z_][\w-]*/)) {
        return 'attributeName';
      }

      if (matchArrowToken(stream) || stream.match(':::')) {
        return 'operator';
      }

      if (stream.match(/[{}\[\]()]/)) {
        return 'bracket';
      }

      if (stream.match(operatorPattern)) {
        return 'operator';
      }

      if (stream.match(/\d+(\.\d+)?/)) {
        return 'number';
      }

      if (stream.match(/[A-Za-z_][\w-]*/)) {
        const word = stream.current().toLowerCase();
        return keywordSet.has(word) ? 'keyword' : 'variableName';
      }

      stream.next();
      return null;
    },
    languageData: {
      commentTokens: { line: '%%' },
      closeBrackets: { brackets: '()[]{}"\'`' },
    },
  });
}

function matchArrowToken(stream: StringStream): boolean {
  for (const token of ARROW_TOKENS) {
    if (stream.match(token)) {
      return true;
    }
  }
  return false;
}

function readQuoted(stream: StringStream, quote: string): void {
  let escaped = false;
  while (!stream.eol()) {
    const ch = stream.next();
    if (!ch) return;
    if (ch === quote && !escaped) return;
    escaped = !escaped && ch === '\\';
  }
}
