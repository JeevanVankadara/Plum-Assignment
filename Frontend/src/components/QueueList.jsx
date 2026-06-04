function statusStyles(status) {
  if (status === "APPROVED") return "text-success bg-success/10";
  if (status === "REJECTED") return "text-error bg-error/10";
  if (status === "PARTIAL") return "text-warning bg-warning/10";
  return "text-warning bg-warning/10";
}

export function QueueList({ claims, selectedId, onSelect }) {
  return (
    <section className="bg-white rounded-xl border border-border overflow-hidden shadow-sm font-sans">
      <div className="px-5 py-4 border-b border-border flex justify-between items-center bg-background/50">
        <h2 className="font-display text-sm font-bold uppercase tracking-wider text-muted-foreground">
          Recent Queue
        </h2>
        <span className="text-[10px] font-mono bg-accent/5 px-2 py-0.5 rounded border border-accent/10 text-accent">
          {claims.length} items
        </span>
      </div>
      <div className="divide-y divide-border max-h-[420px] overflow-y-auto">
        {claims.map((c) => {
          const active = c.id === selectedId;
          return (
            <button
              key={c.id}
              onClick={() => onSelect(c.id)}
              className={`w-full text-left p-4 hover:bg-background/60 transition-colors ${
                active ? "bg-accent/5 border-l-2 border-accent" : ""
              }`}
            >
              <div className="flex justify-between items-start mb-1">
                <span className="text-sm font-semibold text-foreground">{c.patient}</span>
                <span className="text-sm font-mono text-foreground">
                  ₹{c.claimed.toLocaleString("en-IN")}
                </span>
              </div>
              <div className="flex justify-between items-center gap-2">
                <span className="text-xs text-muted-foreground truncate">
                  {c.department} • {c.provider.split(",")[0]}
                </span>
                <span
                  className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded shrink-0 ${statusStyles(
                    c.status
                  )}`}
                >
                  {c.status}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
