interface EvidenceItem {
  label: string;
  value: string;
}

interface EvidenceDrawerProps {
  title: string;
  items: EvidenceItem[];
}

export function EvidenceDrawer({ title, items }: EvidenceDrawerProps) {
  return (
    <aside className="rounded-xl border border-velo-line bg-velo-panel p-4">
      <h3 className="text-base font-semibold">{title}</h3>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={item.label} className="rounded-md bg-white/5 p-2 text-sm">
            <p className="text-velo-muted">{item.label}</p>
            <p>{item.value}</p>
          </li>
        ))}
      </ul>
    </aside>
  );
}
