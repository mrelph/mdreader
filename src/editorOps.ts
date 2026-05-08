// Pure helpers for the markdown editor's keyboard shortcuts. Each function
// returns the next textarea state (text + selection range) given the current
// state, or null when the shortcut shouldn't apply (so the caller can fall
// back to the default browser behaviour).

export type Edit = { next: string; selStart: number; selEnd: number };
export type State = { value: string; start: number; end: number };

// Wrap (or unwrap) a selection with the given before/after markers. If the
// selection itself is already wrapped — either tightly (selection text is
// "**foo**") or loosely (the chars on either side are "**" and "**") —
// the wrappers are stripped so the same shortcut toggles formatting on
// and off, matching most editor conventions.
export function toggleWrap(state: State, before: string, after = before): Edit {
  const { value, start, end } = state;
  const selected = value.slice(start, end);

  // Tight match: the selection itself is "**foo**".
  if (
    selected.length >= before.length + after.length &&
    selected.startsWith(before) &&
    selected.endsWith(after)
  ) {
    const inner = selected.slice(before.length, selected.length - after.length);
    return {
      next: value.slice(0, start) + inner + value.slice(end),
      selStart: start,
      selEnd: start + inner.length,
    };
  }

  // Loose match: chars immediately around the selection are "**" + "**".
  const prevChars = value.slice(Math.max(0, start - before.length), start);
  const nextChars = value.slice(end, end + after.length);
  if (prevChars === before && nextChars === after) {
    return {
      next: value.slice(0, start - before.length) + selected + value.slice(end + after.length),
      selStart: start - before.length,
      selEnd: end - before.length,
    };
  }

  // Default: insert wrappers around the selection (or place caret between
  // them if selection is empty).
  return {
    next: value.slice(0, start) + before + selected + after + value.slice(end),
    selStart: start + before.length,
    selEnd: end + before.length,
  };
}

// Toggle the heading level on the line containing the caret. Pressing the
// same level again (e.g. Ctrl+2 on a line that's already "## …") strips
// the prefix; pressing a different level swaps it.
export function toggleHeading(state: State, level: 1 | 2 | 3): Edit {
  const { value, start } = state;
  const lineStart = value.lastIndexOf('\n', start - 1) + 1;
  const newlineIdx = value.indexOf('\n', start);
  const lineEnd = newlineIdx === -1 ? value.length : newlineIdx;
  const line = value.slice(lineStart, lineEnd);

  const match = line.match(/^(#{1,6})\s+/);
  const prefix = '#'.repeat(level) + ' ';

  let newLine: string;
  if (match) {
    if (match[1].length === level) {
      newLine = line.slice(match[0].length);
    } else {
      newLine = prefix + line.slice(match[0].length);
    }
  } else {
    newLine = prefix + line;
  }

  // Caret offset within the line, adjusted by the prefix length change.
  const offsetInLine = start - lineStart;
  const lengthDelta = newLine.length - line.length;
  const newCaret = Math.max(lineStart, lineStart + offsetInLine + lengthDelta);

  return {
    next: value.slice(0, lineStart) + newLine + value.slice(lineEnd),
    selStart: newCaret,
    selEnd: newCaret,
  };
}

// Continue the current bullet/ordered list when Enter is pressed at the end
// of a list item. Pressing Enter on an *empty* list item (just the marker)
// exits the list instead of inserting a new marker — same as iA Writer,
// VS Code, etc. Returns null when the line isn't a list item so the caller
// uses the default Enter behaviour.
export function continueList(state: State): Edit | null {
  const { value, start, end } = state;
  if (start !== end) return null;

  const lineStart = value.lastIndexOf('\n', start - 1) + 1;
  const line = value.slice(lineStart, start);

  // Bulleted, numbered, or task-list item. Capture: indent, marker token,
  // optional task-checkbox, and the text after.
  const m = line.match(/^(\s*)([-*]|(\d+)\.)\s+(\[[ xX]\]\s+)?(.*)$/);
  if (!m) return null;

  const indent = m[1];
  const marker = m[2];
  const numberStr = m[3];
  const taskBox = m[4];
  const rest = m[5];

  // Empty marker — exit the list.
  if (rest === '' && !taskBox) {
    return {
      next: value.slice(0, lineStart) + value.slice(start),
      selStart: lineStart,
      selEnd: lineStart,
    };
  }

  let nextMarker = marker;
  if (numberStr) {
    nextMarker = `${parseInt(numberStr, 10) + 1}.`;
  }
  const nextTask = taskBox ? '[ ] ' : '';
  const insertion = `\n${indent}${nextMarker} ${nextTask}`;

  return {
    next: value.slice(0, start) + insertion + value.slice(end),
    selStart: start + insertion.length,
    selEnd: start + insertion.length,
  };
}

// Apply a computed edit to a textarea, preserving the next selection.
export function applyEdit(
  textarea: HTMLTextAreaElement,
  edit: Edit,
  onChange: (value: string) => void
) {
  onChange(edit.next);
  // Selection has to be set after React re-renders, so defer one frame.
  requestAnimationFrame(() => {
    textarea.selectionStart = edit.selStart;
    textarea.selectionEnd = edit.selEnd;
  });
}
