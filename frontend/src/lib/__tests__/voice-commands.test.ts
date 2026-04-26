import { describe, expect, it } from 'vitest';

import { COMMAND_LABELS, parseCommand } from '@/lib/voice-commands';

describe('parseCommand', () => {
  it.each([
    ['recap', 'recap'],
    ['recap so far', 'recap'],
    ['send', 'send'],
    ['submit', 'send'],
    ['slow down', 'pacing-slow'],
    ['slower', 'pacing-slow'],
    ['normal pace', 'pacing-normal'],
    ['speed up', 'pacing-normal'],
    ['read aloud', 'tts-on'],
    ['turn on voice', 'tts-on'],
    ['stop reading', 'tts-off'],
    ['turn off voice', 'tts-off'],
    ['stop', 'cancel'],
    ['cancel', 'cancel'],
    ['minimize', 'minimize-on'],
    ['hide controls', 'minimize-on'],
    ['restore', 'minimize-off'],
    ['show controls', 'minimize-off'],
    ['maximize', 'minimize-off'],
  ])('exact match: %s → %s', (transcript, expected) => {
    expect(parseCommand(transcript)).toEqual({ type: expected });
  });

  it('lowercases mixed-case input', () => {
    expect(parseCommand('Recap')).toEqual({ type: 'recap' });
    expect(parseCommand('READ ALOUD')).toEqual({ type: 'tts-on' });
  });

  it('strips leading/trailing whitespace', () => {
    expect(parseCommand('   send   ')).toEqual({ type: 'send' });
  });

  it('collapses internal whitespace', () => {
    expect(parseCommand('slow    down')).toEqual({ type: 'pacing-slow' });
  });

  it('strips trailing punctuation', () => {
    expect(parseCommand('recap.')).toEqual({ type: 'recap' });
    expect(parseCommand('stop!')).toEqual({ type: 'cancel' });
    expect(parseCommand('send?')).toEqual({ type: 'send' });
  });

  it('prefers longer phrase on prefix match — "stop reading" beats "stop"', () => {
    expect(parseCommand('stop reading')).toEqual({ type: 'tts-off' });
  });

  it('prefix match: "stop please" → cancel', () => {
    expect(parseCommand('stop please')).toEqual({ type: 'cancel' });
  });

  it('prefix match: "recap quickly" → recap', () => {
    expect(parseCommand('recap quickly')).toEqual({ type: 'recap' });
  });

  it('returns null on no match', () => {
    expect(parseCommand('open the pod bay doors')).toBeNull();
    expect(parseCommand('hello there')).toBeNull();
  });

  it('returns null on empty / whitespace input', () => {
    expect(parseCommand('')).toBeNull();
    expect(parseCommand('   ')).toBeNull();
  });

  it('exposes a label for every intent type', () => {
    const types = [
      'recap',
      'send',
      'pacing-slow',
      'pacing-normal',
      'tts-on',
      'tts-off',
      'cancel',
      'minimize-on',
      'minimize-off',
    ] as const;
    for (const t of types) {
      expect(COMMAND_LABELS[t]).toBeTruthy();
    }
  });
});