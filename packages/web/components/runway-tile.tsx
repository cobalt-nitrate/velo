import { ConfidenceBadge } from './confidence-badge';

interface RunwayTileProps {
  months: number;
  burnRateInr: number;
  confidence: number;
}

export function RunwayTile({
  months,
  burnRateInr,
  confidence,
}: RunwayTileProps) {
  return (
    <section className="rounded-xl border border-velo-line bg-velo-panel p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Runway</h2>
        <ConfidenceBadge value={confidence} />
      </div>
      <p className="text-4xl font-bold">{months.toFixed(1)} months</p>
      <p className="mt-2 text-sm text-velo-muted">
        Current monthly burn: INR {burnRateInr.toLocaleString('en-IN')}
      </p>
    </section>
  );
}
