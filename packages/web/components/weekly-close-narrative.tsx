interface WeeklyCloseNarrativeProps {
  highlights: string[];
}

export function WeeklyCloseNarrative({ highlights }: WeeklyCloseNarrativeProps) {
  return (
    <section className="rounded-xl border border-velo-line bg-velo-panel p-4">
      <h3 className="text-base font-semibold">Weekly close narrative</h3>
      <ul className="mt-3 list-disc space-y-2 pl-4 text-sm text-velo-muted">
        {highlights.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}
