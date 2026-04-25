import { describe, expect, it } from 'vitest';

import { isTrivialUserMessage, trivialAssistantReply } from './trivial-chat';

describe('trivial-chat', () => {
  it('treats standalone greetings as trivial', () => {
    expect(isTrivialUserMessage('hey', { uploadCount: 0 })).toBe(true);
    expect(isTrivialUserMessage('hey!', { uploadCount: 0 })).toBe(true);
    expect(isTrivialUserMessage('hello there.', { uploadCount: 0 })).toBe(true);
    expect(trivialAssistantReply('hey')).toMatch(/what should we work on/i);
  });

  it('does not treat greeting-prefixed real questions as trivial', () => {
    expect(isTrivialUserMessage('hey how much of my runway is left', { uploadCount: 0 })).toBe(false);
    expect(isTrivialUserMessage('hello — what is my runway?', { uploadCount: 0 })).toBe(false);
  });

  it('keeps thanks/ack strict (standalone only)', () => {
    expect(isTrivialUserMessage('thanks', { uploadCount: 0 })).toBe(true);
    expect(isTrivialUserMessage('thanks!', { uploadCount: 0 })).toBe(true);
    expect(isTrivialUserMessage('thanks for helping with runway', { uploadCount: 0 })).toBe(false);

    expect(isTrivialUserMessage('ok', { uploadCount: 0 })).toBe(true);
    expect(isTrivialUserMessage('ok great, what is my runway', { uploadCount: 0 })).toBe(false);
  });

  it('never fast-paths when uploads are present', () => {
    expect(isTrivialUserMessage('hey', { uploadCount: 1 })).toBe(false);
    expect(isTrivialUserMessage('thanks', { uploadCount: 2 })).toBe(false);
  });
});

