import { useMemo, useState } from "react";

function statusStyles(status) {
  if (status === "APPROVED") return "text-success bg-success/10";
  if (status === "REJECTED") return "text-error bg-error/10";
  if (status === "PARTIAL") return "text-warning bg-warning/10";
  return "text-warning bg-warning/10";
}

function matchesClaim(claim, query) {
  const term = query.trim().toLowerCase();
  if (!term) return true;
  return [claim.patient, claim.memberId, claim.claimNo, claim.id]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(term));
}

export function QueueList({ claims, selectedId, onSelect }) {
  const [query, setQuery] = useState("");
  const filteredClaims = useMemo(
    () => claims.filter((claim) => matchesClaim(claim, query)),
    [claims, query]
  );

  return (
    <section className="bg-white rounded-xl border border-border overflow-hidden shadow-sm font-sans">
      <div className="px-5 py-4 border-b border-border bg-background/50">
        <div className="flex justify-between items-center gap-3">
          <h2 className="font-display text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Recent Queue
          </h2>
          <span className="text-[10px] font-mono bg-accent/5 px-2 py-0.5 rounded border border-accent/10 text-accent">
            {filteredClaims.length}/{claims.length} items
          </span>
        </div>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search name or Plum ID"
          className="mt-3 w-full bg-white border border-border rounded-md px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/20"
        />
      </div>
      <div className="divide-y divide-border max-h-[420px] overflow-y-auto">
        {filteredClaims.length === 0 ? (
          <div className="p-4 text-xs text-muted-foreground text-center">
            No matching claims found.
          </div>
        ) : (
          filteredClaims.map((c) => {
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
                    Rs.{c.claimed.toLocaleString("en-IN")}
                  </span>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-xs text-muted-foreground truncate">
                    {c.memberId} - {c.department} - {c.provider.split(",")[0]}
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
          })
        )}
      </div>
    </section>
  );
}
