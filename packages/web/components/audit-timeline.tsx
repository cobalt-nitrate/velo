interface AuditEventItem {
  id: string;
  timestamp: string;
  event: string;
}

interface AuditTimelineProps {
  events: AuditEventItem[];
}

export function AuditTimeline({ events }: AuditTimelineProps) {
  return (
    <section className="rounded-xl border border-velo-line bg-velo-panel p-4">
      <h3 className="mb-3 text-base font-semibold">Audit timeline</h3>
      <div className="space-y-2">
        {events.map((event) => (
          <div key={event.id} className="rounded-md border border-velo-line/80 bg-velo-inset p-2 text-sm">
            <p>{event.event}</p>
            <p className="text-xs text-velo-muted">{event.timestamp}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
