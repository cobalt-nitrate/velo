import Link from 'next/link';
import type { QueueBand, QueueItem } from '../lib/home/types';

const BAND_LABEL: Record<QueueBand, string> = {
  overdue: 'Overdue',
  due_48h: 'Due in 48 hours',
  this_week: 'This week',
};

const BAND_TONE: Record<QueueBand, string> = {
  overdue: 'text-red-700 bg-red-50 border-red-200',
  due_48h: 'text-amber-800 bg-amber-50 border-amber-200',
  this_week: 'text-velo-muted bg-velo-inset border-velo-line',
};

function QueueRow({ item }: { item: QueueItem }) {
  return (
    <li className="border-b border-velo-line last:border-b-0">
      <Link
        href={item.href}
        className="block px-5 py-4 transition-colors hover:bg-velo-inset focus:bg-velo-inset focus:outline-none focus-visible:ring-2 focus-visible:ring-velo-accent/40"
      >
        <span
          className={`inline-block rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${BAND_TONE[item.band]}`}
        >
          {BAND_LABEL[item.band]}
        </span>

        <p className="mt-2 text-[15px] font-semibold leading-snug text-velo-text">
          {item.headline}
        </p>

        {item.consequence && (
          <p className="mt-1 text-sm text-velo-text/80">{item.consequence}</p>
        )}

        {item.context && <p className="mt-1 text-xs text-velo-muted">{item.context}</p>}
      </Link>
    </li>
  );
}

export function NeedsYou({
  items,
  overflowCount,
}: {
  items: QueueItem[];
  overflowCount: number;
}) {
  if (items.length === 0) {
    return (
      <section className="rounded-xl border border-velo-line bg-velo-panel p-8 text-center shadow-card">
        <h2 className="text-lg font-semibold text-velo-text">You&rsquo;re all clear</h2>
        <p className="mt-1 text-sm text-velo-muted">
          Nothing needs a decision from you right now. Velo is still watching.
        </p>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-xl border border-velo-line bg-velo-panel shadow-card">
      <h2 className="border-b border-velo-line px-5 py-3 text-sm font-semibold text-velo-text">
        {items.length === 1 ? '1 thing needs you' : `${items.length} things need you`}
      </h2>

      <ul>
        {items.map((item) => (
          <QueueRow key={`${item.source}:${item.id}`} item={item} />
        ))}
      </ul>

      {overflowCount > 0 && (
        <Link
          href="/operations"
          className="block border-t border-velo-line px-5 py-2.5 text-center text-xs text-velo-muted hover:bg-velo-inset hover:text-velo-accent"
        >
          {overflowCount} more &middot; nothing else urgent
        </Link>
      )}
    </section>
  );
}
