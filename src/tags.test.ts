import { describe, expect, it } from 'vitest';
import { buildTagIndex, extractTags } from './tags';

describe('extractTags', () => {
  it('extracts hashtags from prose', () => {
    expect(extractTags('Hello #world and #foo-bar')).toEqual(['foo-bar', 'world']);
  });

  it('normalizes to lowercase', () => {
    expect(extractTags('#React #TYPESCRIPT')).toEqual(['react', 'typescript']);
  });

  it('ignores heading markers (# followed by space)', () => {
    expect(extractTags('# Heading\n## Sub')).toEqual([]);
  });

  it('ignores tags inside fenced code blocks', () => {
    expect(extractTags('real #tag\n```\n#inside-code\n```\nmore #stuff')).toEqual(['stuff', 'tag']);
  });

  it('ignores mid-word hashes like C#', () => {
    expect(extractTags('I love C# programming')).toEqual([]);
  });

  it('picks up tags after commas and parens', () => {
    expect(extractTags('(#alpha, #beta)')).toEqual(['alpha', 'beta']);
  });

  it('requires tags to start with a letter', () => {
    expect(extractTags('#123 #_bad #good')).toEqual(['good']);
  });

  it('strips frontmatter before parsing', () => {
    expect(extractTags('---\ntags: [a]\n---\n#real')).toEqual(['real']);
  });
});

describe('buildTagIndex', () => {
  it('counts tag frequency across multiple bodies', () => {
    const index = buildTagIndex(['#a #b', '#a #c', '#b #c #c']);
    expect(index.get('a')).toBe(2);
    expect(index.get('b')).toBe(2);
    expect(index.get('c')).toBe(2); // deduped per-note
  });
});
