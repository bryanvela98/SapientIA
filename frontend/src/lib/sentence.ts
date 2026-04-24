// Returns the last index (inclusive) in `buf` where a sentence ends and the
// following char is whitespace or the buffer ends. A sentence ender is one
// of `. ! ? \n`, optionally followed by a closing quote/bracket. Per-token
// speech is choppy; sentence-buffered speech sounds natural.
export function findLastSentenceEnd(buf: string): number {
  let idx = -1;
  for (let i = 0; i < buf.length; i++) {
    const c = buf[i];
    if (c !== '.' && c !== '!' && c !== '?' && c !== '\n') continue;
    let after = i + 1;
    const next = buf[after];
    if (next === '"' || next === "'" || next === ')' || next === ']') after += 1;
    const tail = buf[after];
    if (tail === undefined || /\s/.test(tail)) idx = after - 1;
  }
  return idx;
}