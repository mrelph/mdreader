import { describe, expect, it } from 'vitest';
import { continueList, toggleHeading, toggleWrap } from './editorOps';

describe('toggleWrap', () => {
  it('wraps an empty selection and places the caret between markers', () => {
    const r = toggleWrap({ value: 'ab', start: 1, end: 1 }, '**');
    expect(r.next).toBe('a****b');
    expect(r.selStart).toBe(3);
    expect(r.selEnd).toBe(3);
  });

  it('wraps a non-empty selection', () => {
    const r = toggleWrap({ value: 'a foo b', start: 2, end: 5 }, '**');
    expect(r.next).toBe('a **foo** b');
    expect(r.selStart).toBe(4);
    expect(r.selEnd).toBe(7);
  });

  it('unwraps when the selection itself is already wrapped (tight)', () => {
    const r = toggleWrap({ value: 'a **foo** b', start: 2, end: 9 }, '**');
    expect(r.next).toBe('a foo b');
    expect(r.selStart).toBe(2);
    expect(r.selEnd).toBe(5);
  });

  it('unwraps when the markers sit just outside the selection (loose)', () => {
    const r = toggleWrap({ value: 'a **foo** b', start: 4, end: 7 }, '**');
    expect(r.next).toBe('a foo b');
    expect(r.selStart).toBe(2);
    expect(r.selEnd).toBe(5);
  });

  it('supports asymmetric markers via a single arg (italics)', () => {
    const r = toggleWrap({ value: 'x', start: 0, end: 1 }, '*');
    expect(r.next).toBe('*x*');
  });
});

describe('toggleHeading', () => {
  it('adds a heading prefix to a plain line', () => {
    const r = toggleHeading({ value: 'title', start: 0, end: 0 }, 2);
    expect(r.next).toBe('## title');
  });

  it('removes the prefix when the same level is toggled again', () => {
    const r = toggleHeading({ value: '## title', start: 4, end: 4 }, 2);
    expect(r.next).toBe('title');
  });

  it('swaps to a different level', () => {
    const r = toggleHeading({ value: '## title', start: 4, end: 4 }, 1);
    expect(r.next).toBe('# title');
  });

  it('only affects the line containing the caret', () => {
    const value = 'one\ntwo\nthree';
    const caret = value.indexOf('two') + 1;
    const r = toggleHeading({ value, start: caret, end: caret }, 3);
    expect(r.next).toBe('one\n### two\nthree');
  });
});

describe('continueList', () => {
  it('continues a bulleted list', () => {
    const value = '- one';
    const r = continueList({ value, start: value.length, end: value.length });
    expect(r?.next).toBe('- one\n- ');
  });

  it('increments an ordered list', () => {
    const value = '1. one';
    const r = continueList({ value, start: value.length, end: value.length });
    expect(r?.next).toBe('1. one\n2. ');
  });

  it('carries the task-list checkbox forward unticked', () => {
    const value = '- [x] done';
    const r = continueList({ value, start: value.length, end: value.length });
    expect(r?.next).toBe('- [x] done\n- [ ] ');
  });

  it('exits the list when Enter is pressed on an empty marker', () => {
    const value = '- ';
    const r = continueList({ value, start: value.length, end: value.length });
    expect(r?.next).toBe('');
  });

  it('preserves indentation for nested items', () => {
    const value = '  - one';
    const r = continueList({ value, start: value.length, end: value.length });
    expect(r?.next).toBe('  - one\n  - ');
  });

  it('returns null on a non-list line so default Enter applies', () => {
    const value = 'plain text';
    expect(continueList({ value, start: value.length, end: value.length })).toBeNull();
  });

  it('returns null when there is a selection', () => {
    expect(continueList({ value: '- one', start: 0, end: 3 })).toBeNull();
  });
});
