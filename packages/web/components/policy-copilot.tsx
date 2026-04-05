export function PolicyCopilot() {
  return (
    <section className="rounded-xl border border-velo-line bg-velo-panel p-4">
      <h3 className="text-base font-semibold">Policy copilot</h3>
      <p className="mt-2 text-sm text-velo-muted">
        Simulate policy changes before rollout.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <label className="text-sm">
          AP auto limit (INR)
          <input
            type="number"
            defaultValue={25000}
            className="mt-1 w-full rounded-md border border-white/10 bg-black/20 px-2 py-1.5"
          />
        </label>
        <label className="text-sm">
          Filing mode
          <select className="mt-1 w-full rounded-md border border-white/10 bg-black/20 px-2 py-1.5">
            <option>Approval required</option>
            <option>Auto execute</option>
          </select>
        </label>
      </div>
      <button className="mt-4 rounded-md bg-velo-accent px-3 py-1.5 text-sm font-medium text-black">
        Simulate impact
      </button>
    </section>
  );
}
