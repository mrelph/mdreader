import { describe, expect, it } from 'vitest';
import {
  buildToc,
  derivePreview,
  deriveTitle,
  slugify,
  stripFrontmatter,
  wordCount,
} from './notes';

describe('stripFrontmatter', () => {
  it('removes a leading YAML block closed with ---', () => {
    const src = '---\ntitle: Hi\ntags: [a]\n---\n# Body\ntext';
    expect(stripFrontmatter(src)).toBe('# Body\ntext');
  });

  it('removes a block closed with ...', () => {
    const src = '---\ntitle: Hi\n...\nBody';
    expect(stripFrontmatter(src)).toBe('Body');
  });

  it('leaves text untouched when there is no frontmatter', () => {
    const src = '# Just a heading\nbody';
    expect(stripFrontmatter(src)).toBe(src);
  });

  it('does not treat a horizontal rule mid-document as frontmatter', () => {
    const src = 'intro\n\n---\n\nmore';
    expect(stripFrontmatter(src)).toBe(src);
  });
});

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('Hello World')).toBe('hello-world');
  });

  it('drops punctuation', () => {
    expect(slugify('What? Now!')).toBe('what-now');
  });

  it('collapses repeat hyphens and trims', () => {
    expect(slugify('  a --- b  ')).toBe('a-b');
  });
});

describe('buildToc', () => {
  it('extracts levels 1-3 with slug ids', () => {
    const toc = buildToc('# One\n## Two\n### Three\n#### Four');
    expect(toc).toEqual([
      { level: 1, text: 'One', id: 'one' },
      { level: 2, text: 'Two', id: 'two' },
      { level: 3, text: 'Three', id: 'three' },
    ]);
  });

  it('ignores headings inside fenced code blocks', () => {
    const toc = buildToc('# Real\n```\n# Not a heading\n```\n## Also real');
    expect(toc.map((t) => t.text)).toEqual(['Real', 'Also real']);
  });

  it('recognises headings inside blockquotes', () => {
    const toc = buildToc('> ## Quoted heading');
    expect(toc).toEqual([{ level: 2, text: 'Quoted heading', id: 'quoted-heading' }]);
  });

  it('disambiguates duplicate headings', () => {
    const toc = buildToc('# Notes\n# Notes');
    expect(toc.map((t) => t.id)).toEqual(['notes', 'notes-1']);
  });

  it('skips a leading frontmatter block', () => {
    const toc = buildToc('---\ntitle: x\n---\n# Heading');
    expect(toc.map((t) => t.text)).toEqual(['Heading']);
  });
});

describe('wordCount', () => {
  it('does not count markdown syntax as words', () => {
    expect(wordCount('# Title\n\n**bold** _text_ here')).toBe(4);
  });

  it('excludes fenced code blocks', () => {
    expect(wordCount('one two\n```\nlots of code words here\n```\nthree')).toBe(3);
  });

  it('excludes frontmatter', () => {
    expect(wordCount('---\ntitle: skip me please\n---\nreal words only')).toBe(3);
  });
});

describe('deriveTitle', () => {
  it('uses the first H1', () => {
    expect(deriveTitle('# Hello\nbody', 'file')).toBe('Hello');
  });

  it('ignores an H1 inside frontmatter and falls back', () => {
    expect(deriveTitle('---\n# not-a-title\n---\nbody', 'file')).toBe('file');
  });

  it('falls back to the filename with no heading', () => {
    expect(deriveTitle('just text', 'file')).toBe('file');
  });
});

describe('derivePreview', () => {
  it('skips frontmatter and headings, keeping the first prose line', () => {
    expect(derivePreview('---\ntitle: x\n---\n# Heading\nFirst real line')).toBe('First real line');
  });
});
