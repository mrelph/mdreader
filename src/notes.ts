import type { Note } from './types';

// Sample journal content seeded into the reader. The user can replace any of
// these by opening their own .md files; the seed exists so the app has
// something to read on first launch.

export const SAMPLE_NOTES: Note[] = [
  {
    id: 'n1',
    title: 'On slow mornings',
    folder: 'Journal',
    date: 'May 4, 2026',
    preview: 'A note on coffee, fog, and the small physics of waking up before everyone else.',
    starred: true,
    body: `# On slow mornings

*May 4, 2026 · 6:42 AM*

There is a particular quality to the air at this hour — half-dark, half-blue, the kind of quiet that makes the kettle sound like a small cathedral.

I keep coming back to a thought from last week:

> The day belongs to whoever claims the first hour of it.

Not as a productivity slogan. More like a small, stubborn fact about attention.

## What I noticed today

- The fog over the rowhouses didn't lift until 8.
- The neighbor's dog barked exactly four times, evenly spaced.
- I forgot the milk and didn't mind.

## A small recipe

Three things, in order:

1. Boil water (just water).
2. Sit at the window without a phone.
3. Drink the water before it's cold.

It sounds like nothing. That's the point.

## Tomorrow

Try writing for ten minutes before opening anything else. No inbox, no feed, no \`pnpm install\`. Just the page.

---

*"The morning is the small door the rest of the day walks through."* — overheard, possibly invented`,
  },
  {
    id: 'n2',
    title: 'Reading list — spring',
    folder: 'Journal',
    date: 'May 1, 2026',
    preview: 'A short, honest list. Things I am actually reading, not things I plan to.',
    starred: false,
    body: `# Reading list — spring

A short, honest list. Things I am **actually** reading, not things I plan to.

## In progress

- *The Peregrine* — J. A. Baker. Re-reading slowly, a few pages a night.
- *A Field Guide to Getting Lost* — Solnit. Bookmarked at p. 84.
- A long essay on Japanese gardens, printed and stapled, no source.

## Finished this month

| Book | Note |
|---|---|
| *The Living Mountain* | The chapter on water alone is worth the year |
| *Pilgrim at Tinker Creek* | Dense; reward per page is high |
| *Bluets* | Re-read in a single sitting |

## Lines I underlined

> "The mind is not a vessel to be filled, but a fire to be kindled."

> "Attention is the rarest and purest form of generosity."

## Up next

Maybe Berger's *About Looking*. Maybe nothing — let the pile breathe.`,
  },
  {
    id: 'n3',
    title: 'Garden, week 18',
    folder: 'Journal',
    date: 'Apr 28, 2026',
    preview: 'Tomatoes are in. The basil is suspicious.',
    starred: false,
    body: `# Garden, week 18

Tomatoes are in. The basil is suspicious.

- 4 *San Marzano*, south bed
- 2 *Sungold*, the warm corner near the wall
- Basil, 6 plants, looking unconvinced

\`\`\`
weather: 14°C, light wind
soil:    damp, two fingers down
mood:    cautious optimism
\`\`\`

Note to self: stake the Sungolds **before** they need it.`,
  },
  {
    id: 'n4',
    title: 'A shape for the week',
    folder: 'Journal',
    date: 'Apr 26, 2026',
    preview: 'Trying a Monday/Friday rhythm with a quiet middle.',
    starred: false,
    body: `# A shape for the week

Trying a new rhythm:

- **Monday** — open, set the week's one real question
- **Tue–Thu** — quiet middle, no meetings before noon
- **Friday** — close, write the week's one real answer

Two weeks in. Friday is hard. The answer is rarely as clean as the question.`,
  },
  {
    id: 'n5',
    title: 'Letters I haven’t sent',
    folder: 'Drafts',
    date: 'Apr 22, 2026',
    preview: 'A folder for things addressed to people who will never read them.',
    starred: true,
    body: `# Letters I haven't sent

A folder for things addressed to people who will never read them — which is, I think, the only kind of letter I write honestly.

---

Dear M.,

I keep meaning to tell you that the kitchen still smells like cardamom on Sundays. You'd hate that I'm telling you and not asking how you are.

How are you?

— J.`,
  },
  {
    id: 'n6',
    title: 'On keeping a notebook',
    folder: 'Essays',
    date: 'Apr 18, 2026',
    preview: 'Notes toward an essay I keep not writing.',
    starred: false,
    body: `# On keeping a notebook

Notes toward an essay I keep not writing.

The notebook is not a record. It is a *practice*. The point is the act of writing things down, not the things written.`,
  },
];

// Build a TOC from heading lines in the markdown body. Used by the right-rail
// outline; entries beyond level 3 are ignored to keep the rail readable.
export function buildToc(src: string) {
  return src
    .split('\n')
    .filter((l) => /^#{1,3} /.test(l))
    .map((l, idx) => {
      const level = l.match(/^(#+)/)![1].length;
      const text = l.replace(/^#+\s/, '').replace(/\*\*?/g, '');
      return { level, text, id: `h${idx}` };
    });
}

export function wordCount(src: string) {
  return src.trim().split(/\s+/).filter(Boolean).length;
}

export function readingMinutes(src: string) {
  return Math.max(1, Math.round(wordCount(src) / 220));
}

// Best-effort title extraction from a markdown blob — first H1, falling back
// to the filename. Used when the user opens their own .md files.
export function deriveTitle(src: string, fallback: string) {
  const m = src.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : fallback;
}

// First non-heading paragraph, trimmed for the sidebar preview.
export function derivePreview(src: string) {
  for (const line of src.split('\n')) {
    const t = line.trim();
    if (!t) continue;
    if (t.startsWith('#')) continue;
    if (t.startsWith('>')) continue;
    if (t.startsWith('```')) continue;
    return t.replace(/[*_`]/g, '').slice(0, 160);
  }
  return '';
}
