'use client';

import type { AgentRunEvent } from '@velo/agents';
import {
  IconChevronLeft,
  IconChevronRight,
  IconLoader,
  IconPlay,
} from '@/components/velo-icons';
import { extractTabular, type TabularPreview } from '@/lib/extract-tabular';
import { useMemo } from 'react';

function urlsInText(s: string): string[] {
  const re = /https?:\/\/[^\s)`"'<>]+/gi;
  return [...new Set(s.match(re) ?? [])];
}

function parseMaybeJson(s: string): unknown {
  try {
    return JSON.parse(s) as unknown;
  } catch {
    return null;
  }
}

function formatCell(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function DataPreview({ table, toolId }: { table: TabularPreview; toolId: string }) {
  const { columns, rows } = table;
  const show = rows.slice(0, 12);
  return (
    <div className="mt-2 overflow-hidden rounded-lg border border-velo-line bg-velo-inset">
      <div className="border-b border-velo-line bg-velo-panel-muted px-2 py-1.5 text-[10px] font-medium uppercase tracking-wide text-velo-muted">
        {table.title ? `${table.title} · ` : ''}
        {toolId}
        <span className="ml-1 font-normal text-velo-muted/80">({rows.length} rows)</span>
      </div>
      <div className="max-h-48 overflow-auto">
        <table className="w-full min-w-[280px] border-collapse text-left text-[11px]">
          <thead>
            <tr className="border-b border-velo-line/80 bg-velo-inset-deep">
              {columns.map((c) => (
                <th key={c} className="sticky top-0 px-2 py-1.5 font-semibold text-velo-accent">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {show.map((row, ri) => (
              <tr key={ri} className="border-b border-velo-line/40 odd:bg-velo-panel-muted/80">
                {columns.map((c) => (
                  <td key={c} className="max-w-[12rem] truncate px-2 py-1 text-velo-text">
                    {formatCell(row[c])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > show.length ? (
        <p className="px-2 py-1 text-[10px] text-velo-muted">Showing first {show.length} rows</p>
      ) : null}
    </div>
  );
}

export function AgentLivePanel({
  events,
  liveThought,
  running,
  className = '',
}: {
  events: AgentRunEvent[];
  liveThought: string;
  running: boolean;
  className?: string;
}) {
  const tables = useMemo(() => {
    const out: Array<{ key: string; toolId: string; table: TabularPreview }> = [];
    for (let i = 0; i < events.length; i++) {
      const e = events[i];
      if (e.type !== 'tool.result') continue;
      const raw =
        e.structured !== undefined ? e.structured : parseMaybeJson(e.preview);
      const tab = extractTabular(raw);
      if (tab && tab.rows.length > 0) {
        out.push({ key: `${e.tool_id}-${i}`, toolId: e.tool_id, table: tab });
      }
    }
    return out;
  }, [events]);

  const docLinks = useMemo(() => {
    const set = new Set<string>();
    for (const e of events) {
      if (e.type === 'tool.result') {
        for (const u of urlsInText(e.preview)) set.add(u);
      }
    }
    return [...set];
  }, [events]);

  const agentStack = useMemo(() => {
    const names = new Set<string>();
    for (const e of events) {
      if (e.type === 'run.start') names.add(e.agent_id);
      if (e.type === 'sub_agent.start') names.add(e.child_agent);
    }
    return [...names];
  }, [events]);

  return (
    <aside
      className={`flex flex-col border-velo-line bg-velo-panel-muted ${className}`.trim()}
    >
      <div className="border-b border-velo-line px-3 py-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-velo-muted">
          Mission control
        </h2>
        <p className="mt-0.5 text-[11px] leading-snug text-velo-muted">
          Live agents, connectors, and data as the run progresses — similar to a multi-agent IDE
          surface.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2">
        {running ? (
          <div className="mb-3 flex items-center gap-2 rounded-lg border border-velo-accent/30 bg-velo-accent/10 px-2 py-1.5 text-[11px] text-velo-accent">
            <IconLoader size={14} className="shrink-0 text-velo-accent" aria-hidden />
            Run in progress…
          </div>
        ) : null}

        {agentStack.length > 0 ? (
          <section className="mb-4">
            <h3 className="text-[10px] font-semibold uppercase text-velo-muted">Agents</h3>
            <ul className="mt-1 flex flex-wrap gap-1">
              {agentStack.map((id) => (
                <li
                  key={id}
                  className="rounded-md border border-velo-line bg-velo-inset px-2 py-0.5 font-mono text-[10px] text-velo-text"
                >
                  {id}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {running && liveThought.trim() ? (
          <section className="mb-4 rounded-lg border border-velo-line bg-velo-inset p-2">
            <h3 className="flex items-center gap-1.5 text-[10px] font-semibold uppercase text-velo-muted">
              <IconPlay size={12} className="text-velo-accent/80" aria-hidden />
              Model (live draft)
            </h3>
            <p className="mt-1 text-[11px] leading-relaxed text-velo-text/90">{liveThought}</p>
            <p className="mt-1.5 text-[10px] text-velo-muted/90">
              Final reply appears in the chat when the run completes — this panel shows live
              reasoning only.
            </p>
          </section>
        ) : null}

        <section className="mb-4">
          <h3 className="text-[10px] font-semibold uppercase text-velo-muted">Connectors & tools</h3>
          <ul className="mt-1 space-y-2">
            {events.map((e, i) => {
              if (e.type === 'tool.proposed') {
                return (
                  <li
                    key={`p-${i}`}
                    className="rounded-md border border-velo-line/80 bg-velo-panel-muted px-2 py-1.5 text-[11px]"
                  >
                    <span className="font-mono text-velo-accent">{e.tool_id}</span>
                    <span className="ml-2 text-[10px] text-velo-muted">{e.policy}</span>
                    <pre className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap break-words text-[10px] text-velo-muted">
                      {e.parameters_preview}
                    </pre>
                  </li>
                );
              }
              if (e.type === 'tool.executing') {
                return (
                  <li key={`x-${i}`} className="flex items-center gap-2 text-[11px] text-amber-900">
                    <IconLoader size={12} className="shrink-0 text-amber-600" aria-hidden />
                    Running <span className="font-mono">{e.tool_id}</span>
                  </li>
                );
              }
              if (e.type === 'tool.result') {
                return (
                  <li
                    key={`r-${i}`}
                    className="rounded-md border border-emerald-200/80 bg-emerald-50/80 px-2 py-1.5"
                  >
                    <span className="font-mono text-[11px] text-emerald-800">{e.tool_id}</span>
                    <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-words text-[10px] text-velo-muted">
                      {e.preview}
                    </pre>
                  </li>
                );
              }
              if (e.type === 'sub_agent.start') {
                return (
                  <li key={`ss-${i}`} className="flex items-center gap-1.5 text-[11px] text-teal-800">
                    <IconChevronRight size={14} className="shrink-0 text-velo-accent" aria-hidden />
                    Sub-agent <span className="font-mono">{e.child_agent}</span>
                  </li>
                );
              }
              if (e.type === 'sub_agent.end') {
                return (
                  <li key={`se-${i}`} className="flex items-center gap-1.5 text-[10px] text-velo-muted">
                    <IconChevronLeft size={14} className="shrink-0 text-velo-muted" aria-hidden />
                    {e.child_agent}{' '}
                    <span className="text-velo-text">{e.status}</span>
                  </li>
                );
              }
              if (e.type === 'iteration') {
                return (
                  <li key={`it-${i}`} className="text-[10px] text-velo-muted/80">
                    Loop {e.iteration}
                  </li>
                );
              }
              if (e.type === 'run.blocked') {
                return (
                  <li
                    key={`bl-${i}`}
                    className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] text-rose-900"
                  >
                    Blocked ({e.reason}): {e.message}
                  </li>
                );
              }
              return null;
            })}
          </ul>
        </section>

        {tables.length > 0 ? (
          <section className="mb-4">
            <h3 className="text-[10px] font-semibold uppercase text-velo-muted">Data boards</h3>
            <div className="mt-2 space-y-3">
              {tables.map((t) => (
                <DataPreview key={t.key} table={t.table} toolId={t.toolId} />
              ))}
            </div>
          </section>
        ) : null}

        {docLinks.length > 0 ? (
          <section>
            <h3 className="text-[10px] font-semibold uppercase text-velo-muted">Links</h3>
            <ul className="mt-1 space-y-1">
              {docLinks.map((u) => (
                <li key={u} className="truncate text-[11px]">
                  <a href={u} className="text-velo-accent hover:underline" target="_blank" rel="noreferrer">
                    {u}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {!running && events.length === 0 && !liveThought ? (
          <p className="text-[11px] text-velo-muted">
            Send a message to see agents and tools stream here in real time.
          </p>
        ) : null}
      </div>
    </aside>
  );
}
