'use client';

import { Fragment, type ReactNode } from 'react';

function formatInline(text: string, keyBase: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let remaining = text;
  let k = 0;
  while (remaining.length) {
    const code = remaining.match(/^`([^`]+)`/);
    if (code) {
      parts.push(
        <code
          key={`${keyBase}-c-${k++}`}
          className="rounded bg-black/35 px-1 py-0.5 font-mono text-[0.9em] text-velo-accent"
        >
          {code[1]}
        </code>
      );
      remaining = remaining.slice(code[0].length);
      continue;
    }
    const bold = remaining.match(/^\*\*([^*]+)\*\*/);
    if (bold) {
      parts.push(
        <strong key={`${keyBase}-b-${k++}`} className="font-semibold text-velo-text">
          {bold[1]}
        </strong>
      );
      remaining = remaining.slice(bold[0].length);
      continue;
    }
    const italicStar = remaining.match(/^\*([^*]+)\*/);
    if (italicStar) {
      parts.push(<em key={`${keyBase}-i-${k++}`}>{italicStar[1]}</em>);
      remaining = remaining.slice(italicStar[0].length);
      continue;
    }
    const italicUnder = remaining.match(/^_([^_]+)_/);
    if (italicUnder) {
      parts.push(<em key={`${keyBase}-iu-${k++}`}>{italicUnder[1]}</em>);
      remaining = remaining.slice(italicUnder[0].length);
      continue;
    }
    const link = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/);
    if (link) {
      parts.push(
        <a
          key={`${keyBase}-a-${k++}`}
          href={link[2]}
          className="text-velo-accent underline decoration-velo-accent/40 underline-offset-2 hover:decoration-velo-accent"
          target="_blank"
          rel="noreferrer"
        >
          {link[1]}
        </a>
      );
      remaining = remaining.slice(link[0].length);
      continue;
    }
    const next = remaining.search(/[`[*_]/);
    if (next === -1) {
      parts.push(remaining);
      break;
    }
    if (next === 0) {
      parts.push(remaining[0]);
      remaining = remaining.slice(1);
      continue;
    }
    parts.push(remaining.slice(0, next));
    remaining = remaining.slice(next);
  }
  return parts;
}

function splitFenced(
  text: string
): Array<{ type: 'code' | 'text'; value: string; lang?: string }> {
  const out: Array<{ type: 'code' | 'text'; value: string; lang?: string }> = [];
  const re = /```(\w*)\n?([\s\S]*?)```/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push({ type: 'text', value: text.slice(last, m.index) });
    out.push({ type: 'code', value: m[2] ?? '', lang: m[1] || undefined });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ type: 'text', value: text.slice(last) });
  if (out.length === 0) out.push({ type: 'text', value: text });
  return out;
}

function renderLinesAsParagraphs(body: string, keyPrefix: string): ReactNode[] {
  const lines = body.split('\n');
  const blocks: ReactNode[] = [];
  let buf: string[] = [];
  let i = 0;
  const flushPara = () => {
    if (!buf.length) return;
    const raw = buf.join('\n').trimEnd();
    buf = [];
    if (!raw.trim()) return;
    const t = raw.trim();
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(t)) {
      blocks.push(
        <hr key={`${keyPrefix}-hr-${i++}`} className="my-4 border-0 border-t border-velo-line" />
      );
      return;
    }
    if (t.startsWith('### ')) {
      blocks.push(
        <h3 key={`${keyPrefix}-h-${i++}`} className="mb-1 mt-3 text-base font-semibold text-velo-text">
          {formatInline(t.slice(4).trim(), `${keyPrefix}-h3`)}
        </h3>
      );
      return;
    }
    if (t.startsWith('## ')) {
      blocks.push(
        <h2 key={`${keyPrefix}-h-${i++}`} className="mb-1 mt-4 text-lg font-semibold text-velo-text">
          {formatInline(t.slice(3).trim(), `${keyPrefix}-h2`)}
        </h2>
      );
      return;
    }
    if (t.startsWith('# ')) {
      blocks.push(
        <h1 key={`${keyPrefix}-h-${i++}`} className="mb-1 mt-4 text-xl font-semibold tracking-tight text-velo-text">
          {formatInline(t.slice(2).trim(), `${keyPrefix}-h1`)}
        </h1>
      );
      return;
    }
    const paraLines = raw.split('\n');
    const isUl = paraLines.every((l) => /^\s*[-*]\s+/.test(l) || l.trim() === '');
    if (isUl && paraLines.some((l) => l.trim())) {
      const items = paraLines.filter((l) => l.trim()).map((l) => l.replace(/^\s*[-*]\s+/, ''));
      blocks.push(
        <ul key={`${keyPrefix}-ul-${i++}`} className="my-2 list-disc space-y-1.5 pl-5 marker:text-velo-muted">
          {items.map((item, j) => (
            <li key={j} className="leading-relaxed">
              {formatInline(item, `${keyPrefix}-uli-${j}`)}
            </li>
          ))}
        </ul>
      );
      return;
    }
    const isOl = paraLines.every((l) => /^\s*\d+\.\s+/.test(l) || l.trim() === '');
    if (isOl && paraLines.some((l) => l.trim())) {
      const items = paraLines.filter((l) => l.trim()).map((l) => l.replace(/^\s*\d+\.\s+/, ''));
      blocks.push(
        <ol key={`${keyPrefix}-ol-${i++}`} className="my-2 list-decimal space-y-1.5 pl-5 marker:text-velo-muted">
          {items.map((item, j) => (
            <li key={j} className="leading-relaxed">
              {formatInline(item, `${keyPrefix}-oli-${j}`)}
            </li>
          ))}
        </ol>
      );
      return;
    }
    const isQuote = paraLines.every((l) => /^\s*>\s?/.test(l) || l.trim() === '');
    if (isQuote && paraLines.some((l) => l.trim())) {
      const q = paraLines
        .filter((l) => l.trim())
        .map((l) => l.replace(/^\s*>\s?/, ''))
        .join('\n');
      blocks.push(
        <blockquote
          key={`${keyPrefix}-bq-${i++}`}
          className="my-2 border-l-2 border-velo-accent/50 pl-3 italic text-velo-muted"
        >
          {formatInline(q.replace(/\n/g, ' '), `${keyPrefix}-bqin`)}
        </blockquote>
      );
      return;
    }
    const withBreaks = paraLines.map((line, li) => (
      <Fragment key={li}>
        {li > 0 ? <br /> : null}
        {formatInline(line, `${keyPrefix}-ln-${li}`)}
      </Fragment>
    ));
    blocks.push(
      <p key={`${keyPrefix}-p-${i++}`} className="my-2 leading-relaxed text-velo-text">
        {withBreaks}
      </p>
    );
  };
  for (const line of lines) {
    if (line.trim() === '' && buf.length > 0) flushPara();
    else if (line.trim() === '' && buf.length === 0) continue;
    else buf.push(line);
  }
  flushPara();
  return blocks;
}

export function MarkdownBody({ text, className = '' }: { text: string; className?: string }) {
  const chunks = splitFenced(text);
  return (
    <div className={`markdown-body text-sm ${className}`.trim()}>
      {chunks.map((ch, idx) =>
        ch.type === 'code' ? (
          <pre
            key={`code-${idx}`}
            className="my-3 max-h-[min(24rem,50vh)] overflow-auto rounded-xl border border-velo-line bg-black/40 p-3 text-xs leading-relaxed text-velo-text shadow-inner"
          >
            {ch.lang ? (
              <span className="mb-2 block text-[10px] font-medium uppercase tracking-wide text-velo-muted">
                {ch.lang}
              </span>
            ) : null}
            <code className="font-mono text-[13px] text-emerald-200/90">{ch.value.replace(/\n$/, '')}</code>
          </pre>
        ) : (
          <Fragment key={`txt-${idx}`}>{renderLinesAsParagraphs(ch.value, `b${idx}`)}</Fragment>
        )
      )}
    </div>
  );
}
