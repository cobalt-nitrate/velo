import { NeedsYou } from '../components/needs-you';
import { collectQueueItems } from '../lib/home/collect';
import { formatInrShort } from '../lib/home/format';
import { rankQueue } from '../lib/home/rank';
import { getRunway } from '../lib/home/runway';

export const dynamic = 'force-dynamic';

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-velo-muted">{label}</dt>
      <dd className="mt-0.5 text-lg font-semibold tabular-nums text-velo-text">{value}</dd>
    </div>
  );
}

export default async function HomePage() {
  const now = new Date();

  const [queue, runway] = await Promise.all([
    collectQueueItems(now),
    getRunway().catch(() => null),
  ]);

  const { visible, overflowCount } = rankQueue(queue.items);

  return (
    <main className="mx-auto grid max-w-3xl gap-6 p-6">
      <NeedsYou items={visible} overflowCount={overflowCount} />

      {runway && runway.runway_months !== null && (
        <section className="rounded-xl border border-velo-line bg-velo-panel px-5 py-4 shadow-soft">
          <dl className="flex flex-wrap gap-x-10 gap-y-4">
            <Stat label="Runway" value={`${runway.runway_months} months`} />
            <Stat label="In the bank" value={formatInrShort(runway.balance_inr)} />
            <Stat label="Monthly burn" value={formatInrShort(runway.burn_monthly_inr)} />
          </dl>
          {runway.as_of_date && (
            <p className="mt-3 text-xs text-velo-muted">
              Based on bank data up to {runway.as_of_date}.
            </p>
          )}
        </section>
      )}

      {queue.errors.length > 0 && (
        <section className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          <p className="font-medium">Some of your data could not be read.</p>
          <p className="mt-1 text-amber-800">
            This list may be incomplete. {queue.errors.length} source
            {queue.errors.length === 1 ? '' : 's'} failed to load.
          </p>
        </section>
      )}
    </main>
  );
}
