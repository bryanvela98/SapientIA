import { describe, expect, it } from 'vitest';

import { findLastSentenceEnd } from '@/lib/sentence';

describe('findLastSentenceEnd', () => {
  it('returns -1 when no terminator is present', () => {
    expect(findLastSentenceEnd('hello world')).toBe(-1);
  });

  it('skips a mid-word period followed by a letter (e.g. case)', () => {
    // "e.g." — the first '.' is followed by 'g', not whitespace, so it is
    // NOT a boundary. The trailing '. ' is a boundary (acceptable TTS pause).
    const s = 'so e.g. the thing';
    const end = findLastSentenceEnd(s);
    expect(s.slice(0, end + 1)).toBe('so e.g.');
  });

  it('treats ". " as a sentence boundary', () => {
    const s = 'Hi there. Next sentence';
    const end = findLastSentenceEnd(s);
    expect(end).toBe(s.indexOf('.'));
    expect(s.slice(0, end + 1)).toBe('Hi there.');
  });

  it('treats ".\\n" as a sentence boundary', () => {
    const s = 'Line one.\nLine two';
    const end = findLastSentenceEnd(s);
    expect(s.slice(0, end + 1)).toBe('Line one.');
  });

  it('picks the last boundary when multiple sentences are present', () => {
    const s = 'One. Two. Three ';
    const end = findLastSentenceEnd(s);
    expect(s.slice(0, end + 1)).toBe('One. Two.');
  });

  it('includes a closing quote after the terminator', () => {
    const s = 'She said "hi." Next thing';
    const end = findLastSentenceEnd(s);
    expect(s.slice(0, end + 1)).toBe('She said "hi."');
  });

  it('treats a trailing period with no following char as a boundary', () => {
    const s = 'Terminal sentence.';
    const end = findLastSentenceEnd(s);
    expect(end).toBe(s.length - 1);
  });

  it('handles ! and ? terminators', () => {
    expect(findLastSentenceEnd('Really? Yes!')).toBe('Really? Yes!'.length - 1);
  });
});