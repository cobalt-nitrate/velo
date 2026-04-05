'use client';

import { IconTable } from '@/components/velo-icons';
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
          className="rounded bg-velo-inset-deep px-1 py-0.5 font-mono text-[0.9em] text-velo-accent"
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

function parseRowCells(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());
}

function isSeparatorRow(line: string): boolean {
  const parts = parseRowCells(line).filter((s) => s.length > 0);
  if (parts.length < 2) return false;
  return parts.every((p) => /^:?-{2,}:?$/.test(p));
}

function parseGfmTable(lines: string[]): { headers: string[]; rows: string[][] } | null {
  if (lines.length < 2) return null;
  const headers = parseRowCells(lines[0]!);
  if (!isSeparatorRow(lines[1]!)) return null;
  const rows = lines
    .slice(2)
    .filter((l) => l.trim())
    .map(parseRowCells)
    .filter((r) => r.some((c) => c.length > 0));
  if (!headers.length || !headers.some((h) => h.length)) return null;
  const width = headers.length;
  const norm = rows.map((r) => {
    const copy = [...r];
    while (copy.length < width) copy.push('');
    return copy.slice(0, width);
  });
  return { headers, rows: norm };
}

/** Pipes-only blocks without a --- separator (some models skip it). */
function parseSimplePipeTable(lines: string[]): { headers: string[]; rows: string[][] } | null {
  if (lines.length < 2) return null;
  const rows = lines.filter((l) => l.trim()).map(parseRowCells);
  if (rows.length < 2) return null;
  const w = rows[0]!.length;
  if (w < 2) return null;
  if (!rows.every((r) => r.length === w)) return null;
  const headers = rows[0]!;
  const body = rows.slice(1);
  return { headers, rows: body };
}

function MarkdownTable({
  headers,
  rows,
  tkey,
}: {
  headers: string[];
  rows: string[][];
  tkey: string;
}) {
  return (
    <div className="my-4 overflow-hidden rounded-xl border border-velo-line bg-velo-inset shadow-sm">
      <div className="flex items-center gap-2 border-b border-velo-line bg-velo-inset-deep px-3 py-2">
        <IconTable size={14} className="shrink-0 text-velo-accent/90" />
        <span className="text-[10px] font-medium uppercase tracking-wide text-velo-muted">
          {rows.length} row{rows.length === 1 ? '' : 's'}
        </span>
      </div>
      <div className="max-h-[min(24rem,55vh)] overflow-auto">
        <table className="w-full min-w-[280px] border-collapse text-left text-[13px]">
          <thead>
            <tr className="border-b border-velo-line bg-velo-inset-deep">
              {headers.map((h, hi) => (
                <th
                  key={`${tkey}-h-${hi}`}
                  className="sticky top-0 px-3 py-2.5 text-left text-xs font-semibold text-velo-accent"
                >
                  {formatInline(h, `${tkey}-hh-${hi}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={`${tkey}-r${ri}`} className="border-b border-velo-line/45 odd:bg-velo-panel-muted/90">
                {headers.map((_, ci) => (
                  <td
                    key={`${tkey}-c${ri}-${ci}`}
                    className="max-w-[22rem] whitespace-pre-wrap break-words px-3 py-2 leading-relaxed text-velo-text"
                  >
                    {row[ci] ? formatInline(row[ci]!, `${tkey}-cell-${ri}-${ci}`) : '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type TextTableSeg =
  | { type: 'text'; value: string }
  | { type: 'table'; headers: string[]; rows: string[][] };

function segmentTextWithTables(body: string): TextTableSeg[] {
  const lines = body.split('\n');
  const out: TextTableSeg[] = [];
  let buf: string[] = [];
  let i = 0;
  const flushBuf = () => {
    if (buf.length) {
      out.push({ type: 'text', value: buf.join('\n') });
      buf = [];
    }
  };
  while (i < lines.length) {
    const line = lines[i]!;
    const isTableRow = line.includes('|') && line.trim().length > 0;
    if (isTableRow) {
      const block: string[] = [];
      while (i < lines.length) {
        const L = lines[i]!;
        if (!L.trim()) break;
        if (!L.includes('|')) break;
        block.push(L);
        i++;
      }
      let parsed: { headers: string[]; rows: string[][] } | null = null;
      if (block.length >= 2 && isSeparatorRow(block[1]!)) {
        parsed = parseGfmTable(block);
      }
      if (!parsed && block.length >= 2) {
        parsed = parseSimplePipeTable(block);
      }
      if (parsed) {
        flushBuf();
        out.push({ type: 'table', ...parsed });
        continue;
      }
      buf.push(...block);
      continue;
    }
    buf.push(line);
    i++;
  }
  flushBuf();
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
        <hr key={`${keyPrefix}-hr-${i++}`} className="my-5 border-0 border-t border-velo-line" />
      );
      return;
    }
    if (t.startsWith('### ')) {
      blocks.push(
        <h3 key={`${keyPrefix}-h-${i++}`} className="mb-1.5 mt-4 text-base font-semibold text-velo-text">
          {formatInline(t.slice(4).trim(), `${keyPrefix}-h3`)}
        </h3>
      );
      return;
    }
    if (t.startsWith('## ')) {
      blocks.push(
        <h2 key={`${keyPrefix}-h-${i++}`} className="mb-1.5 mt-5 text-lg font-semibold text-velo-text">
          {formatInline(t.slice(3).trim(), `${keyPrefix}-h2`)}
        </h2>
      );
      return;
    }
    if (t.startsWith('# ')) {
      blocks.push(
        <h1
          key={`${keyPrefix}-h-${i++}`}
          className="mb-2 mt-5 text-xl font-semibold tracking-tight text-velo-text"
        >
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
        <ul
          key={`${keyPrefix}-ul-${i++}`}
          className="my-3 list-disc space-y-2 pl-5 marker:text-velo-accent/70"
        >
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
        <ol
          key={`${keyPrefix}-ol-${i++}`}
          className="my-3 list-decimal space-y-2 pl-5 marker:font-semibold marker:text-velo-muted"
        >
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
          className="my-3 border-l-2 border-velo-accent/50 bg-velo-inset py-1 pl-4 pr-2 text-velo-muted"
        >
          <div className="leading-relaxed">{formatInline(q.replace(/\n/g, ' '), `${keyPrefix}-bqin`)}</div>
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
      <p key={`${keyPrefix}-p-${i++}`} className="my-2.5 leading-relaxed text-velo-text">
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
  let tableCounter = 0;
  return (
    <div className={`markdown-body text-sm leading-relaxed ${className}`.trim()}>
      {chunks.map((ch, idx) =>
        ch.type === 'code' ? (
          <pre
            key={`code-${idx}`}
            className="my-4 max-h-[min(28rem,55vh)] overflow-auto rounded-xl border border-velo-line bg-velo-inset-deep p-4 text-xs leading-relaxed text-velo-text shadow-soft"
          >
            {ch.lang ? (
              <span className="mb-2 block text-[10px] font-medium uppercase tracking-wide text-velo-muted">
                {ch.lang}
              </span>
            ) : null}
            <code className="font-mono text-[13px] text-teal-900">{ch.value.replace(/\n$/, '')}</code>
          </pre>
        ) : (
          <Fragment key={`txt-${idx}`}>
            {segmentTextWithTables(ch.value).map((seg, j) =>
              seg.type === 'table' ? (
                <MarkdownTable
                  key={`tbl-${idx}-${j}-${tableCounter++}`}
                  headers={seg.headers}
                  rows={seg.rows}
                  tkey={`b${idx}-${j}`}
                />
              ) : (
                <Fragment key={`seg-${idx}-${j}`}>
                  {renderLinesAsParagraphs(seg.value, `b${idx}-${j}`)}
                </Fragment>
              )
            )}
          </Fragment>
        )
      )}
    </div>
  );
}
