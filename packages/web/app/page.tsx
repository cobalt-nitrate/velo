import { getServerSession } from 'next-auth';
import { Handled } from '../components/handled';
import { NeedsYou } from '../components/needs-you';
import { authOptions } from '../lib/auth';
import { getHandledSummary } from '../lib/home/activity';
import { collectQueueItems } from '../lib/home/collect';
import { formatInrShort } from '../lib/home/format';
import { getNextHorizonItem } from '../lib/home/horizon';
import { filterByRole, rankQueue } from '../lib/home/rank';
import { seesEverything, toQueueRole } from '../lib/home/roles';
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
  const session = await getServerSession(authOptions);
  const role = toQueueRole((session?.user as { actor_role?: string } | undefined)?.actor_role);

  // Each of these degrades to nothing rather than taking the page down with it.
  const [queue, runway, nextUp, handled] = await Promise.all([
    collectQueueItems(now),
    getRunway().catch(() => null),
    getNextHorizonItem(now).catch(() => null),
    getHandledSummary(now).catch(() => null),
  ]);

  // UX-003: a founder owns every consequence, so they are never filtered.
  // Everyone else sees only what is addressed to them.
  const scoped = seesEverything(role) ? queue.items : filterByRole(queue.items, role);
  const { visible, overflowCount } = rankQueue(scoped);

  // Cash position is a founder/finance concern, not something an employee needs.
  const showMoney = role === 'founder' || role === 'finance';

  return (
    <main className="mx-auto grid max-w-3xl gap-6 p-6">
      <NeedsYou items={visible} overflowCount={overflowCount} nextUp={nextUp} />

      <Handled summary={handled} />

      {showMoney && runway && runway.runway_months !== null && (
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
