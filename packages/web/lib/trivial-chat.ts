export type TrivialChatCategory =
  | 'greeting'
  | 'gratitude'
  | 'ack'
  | 'capabilities'
  | 'help'
  | 'unknown_short';

export type TrivialChatRule = {
  id: string;
  category: TrivialChatCategory;
  /** If it matches, we fast-path (no agent run). */
  match: RegExp;
  /** Candidate replies; we pick the first for determinism. */
  replies: string[];
};

function normalizeTrivialText(input: string): string {
  // Normalize to improve rule robustness without matching substrings.
  // We intentionally keep internal punctuation out; rules are meant to match
  // the full (trimmed) message, not a prefix like "hey <real question>".
  return input
    .trim()
    .toLowerCase()
    .replace(/[“”]/g, '"')
    .replace(/[’]/g, "'")
    .replace(/\s+/g, ' ');
}

export const TRIVIAL_CHAT_CONFIG: {
  /**
   * Fast-path only when no uploads are present.
   * This avoids skipping agent/tool context when a user attached files.
   */
  requireNoUploads: true;
  /** Maximum trimmed length that can be treated as a "short ping". */
  maxShortLength: number;
  /** Ordered rules: first match wins. */
  rules: TrivialChatRule[];
  /** Fallback reply when we decide it's trivial but no rule matches. */
  defaultReply: string;
} = {
  requireNoUploads: true,
  maxShortLength: 6,
  rules: [
    {
      id: 'greeting.basic',
      category: 'greeting',
      // Only match standalone greetings (no substantive follow-up).
      match:
        /^(hi|hello|hey|yo|sup|hii+|helloo+|hey+)(\s+(there|ya|you))?\s*([!.?,]+)?$/i,
      replies: [
        'Hey — what should we work on? You can paste an Ops row, approval id, or just describe the situation.',
      ],
    },
    {
      id: 'greeting.time',
      category: 'greeting',
      match: /^(good\s*(morning|afternoon|evening|night))\s*([!.?,]+)?$/i,
      replies: [
        'Hey — what’s on your plate today? Approvals, AP/AR, compliance, bank, or HR?',
      ],
    },
    {
      id: 'gratitude',
      category: 'gratitude',
      // Keep this strict: "thanks" is trivial, but "thanks for helping with runway"
      // should go through the agent.
      match: /^(thanks|thank you|thx|ty)\s*([!.?,]+)?$/i,
      replies: ['Anytime. Want to keep going on the same item, or switch to a different module?'],
    },
    {
      id: 'ack.short',
      category: 'ack',
      match: /^(ok|okay|cool|nice|great|got it|kk|k)\s*([!.?,]+)?$/i,
      replies: ['Cool. What do you want to do next — review, approve, or investigate?'],
    },
    {
      id: 'capabilities',
      category: 'capabilities',
      match: /^(what can you do|what do you do|how does this work)\??$/i,
      replies: [
        [
          'I can help you run back-office work end-to-end:',
          '- Triage a row (what it means, what to do next)',
          '- Draft a mission plan (what to verify → what to do)',
          '- After you approve: execute safe reads/writes via configured tools',
          '',
          'Tell me what you’re trying to do (e.g. “approve payroll payout”, “why is AR overdue”, “what’s my runway”).',
        ].join('\n'),
      ],
    },
    {
      id: 'help',
      category: 'help',
      match: /^(help|help me)\??$/i,
      replies: [
        'Sure — tell me what you’re trying to accomplish and any identifiers you have (approval id, invoice #, employee id, due date).',
      ],
    },
  ],
  defaultReply: 'Hey — what should we work on?',
};

export function isTrivialUserMessage(text: string, opts: { uploadCount: number }): boolean {
  const t = text.trim();
  if (!t) return false;
  if (TRIVIAL_CHAT_CONFIG.requireNoUploads && opts.uploadCount > 0) return false;
  const lower = normalizeTrivialText(t);
  for (const r of TRIVIAL_CHAT_CONFIG.rules) {
    if (r.match.test(lower)) return true;
  }
  return t.length <= TRIVIAL_CHAT_CONFIG.maxShortLength;
}

export function trivialAssistantReply(text: string): string {
  const lower = normalizeTrivialText(text);
  for (const r of TRIVIAL_CHAT_CONFIG.rules) {
    if (r.match.test(lower)) {
      return r.replies[0] ?? TRIVIAL_CHAT_CONFIG.defaultReply;
    }
  }
  return TRIVIAL_CHAT_CONFIG.defaultReply;
}

