import { describe, expect, it } from 'vitest';
import { buildResolver, extractWikilinks, normaliseTarget, replaceWikilinks } from './wikilinks';
import type { Note } from './types';

describe('extractWikilinks', () => {
  it('finds basic [[target]] links', () => {
    const links = extractWikilinks('See [[My Note]] for details.');
    expect(links).toEqual([{ target: 'My Note', label: 'My Note' }]);
  });

  it('supports [[target|label]] syntax', () => {
    const links = extractWikilinks('Link to [[file-name|display text]] here.');
    expect(links).toEqual([{ target: 'file-name', label: 'display text' }]);
  });

  it('finds multiple wikilinks', () => {
    const links = extractWikilinks('[[A]] and [[B|second]]');
    expect(links).toHaveLength(2);
    expect(links[0].target).toBe('A');
    expect(links[1].target).toBe('B');
    expect(links[1].label).toBe('second');
  });

  it('ignores wikilinks inside fenced code blocks', () => {
    const links = extractWikilinks('real [[A]]\n```\n[[B]]\n```\nmore [[C]]');
    expect(links.map((l) => l.target)).toEqual(['A', 'C']);
  });

  it('ignores wikilinks inside inline code', () => {
    const links = extractWikilinks('use `[[Not a link]]` but [[real]]');
    expect(links.map((l) => l.target)).toEqual(['real']);
  });
});

describe('normaliseTarget', () => {
  it('lowercases and collapses whitespace', () => {
    expect(normaliseTarget('  My  Note  ')).toBe('my note');
  });
});

describe('buildResolver', () => {
  const notes: Note[] = [
    { id: 'n1', title: 'Alpha', folder: '', date: '', preview: '', starred: false, body: '', path: '/notes/alpha.md' },
    { id: 'n2', title: 'Beta Note', folder: '', date: '', preview: '', starred: false, body: '', path: '/notes/beta-note.md' },
  ];

  it('resolves by title', () => {
    const r = buildResolver(notes);
    expect(r.get('alpha')).toBe('n1');
    expect(r.get('beta note')).toBe('n2');
  });

  it('resolves by filename stem', () => {
    const r = buildResolver(notes);
    expect(r.get('beta-note')).toBe('n2');
  });
});

describe('replaceWikilinks', () => {
  const resolver = new Map([['alpha', 'n1']]);

  it('rewrites resolved links to anchor links', () => {
    const out = replaceWikilinks('See [[Alpha]] here', resolver);
    expect(out).toContain('[Alpha](#wikilink=Alpha)');
  });

  it('marks unresolved links as missing', () => {
    const out = replaceWikilinks('See [[Unknown]] here', resolver);
    expect(out).toContain('[Unknown](#wikilink-missing=Unknown)');
  });

  it('preserves display labels', () => {
    const out = replaceWikilinks('[[Alpha|click here]]', resolver);
    expect(out).toContain('[click here](#wikilink=Alpha)');
  });

  it('does not rewrite wikilinks in code blocks', () => {
    const out = replaceWikilinks('```\n[[Alpha]]\n```', resolver);
    expect(out).toContain('[[Alpha]]');
    expect(out).not.toContain('#wikilink');
  });
});
