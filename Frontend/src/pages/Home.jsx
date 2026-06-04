// src/pages/Home.jsx — plain React (no @tanstack/react-router)
import { useEffect, useState, useCallback } from "react";
import { TopNav } from "../components/TopNav";
import { UploadCard } from "../components/UploadCard";
import { QueueList } from "../components/QueueList";
import { ClaimDetail } from "../components/ClaimDetail";
import { Footer } from "../components/Footer";
import { api, adaptClaimSummary, adaptClaimDetail } from "../lib/api";

export default function Home() {
  const [claims, setClaims] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const refreshList = useCallback(async () => {
    try {
      const list = await api.list();
      const adapted = list.map(adaptClaimSummary);
      setClaims(adapted);
      setSelectedId((cur) => cur || adapted[0]?.id || null);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => { refreshList(); }, [refreshList]);

  useEffect(() => {
    if (!selectedId) { setSelected(null); return; }
    let cancelled = false;
    api.get(selectedId)
      .then((c) => !cancelled && setSelected(adaptClaimDetail(c)))
      .catch((e) => !cancelled && setError(e.message));
    return () => { cancelled = true; };
  }, [selectedId]);

  async function handleSubmit({ memberId, files }) {
    setBusy(true); setError(null);
    try {
      const created = await api.create({ memberId, files });
      await refreshList();
      setSelectedId(created._id);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDecision(id, decision) {
    try {
      const backendDecision = decision === "Approved" ? "APPROVED" : "REJECTED";
      const updated = await api.decide(id, backendDecision);
      setSelected(adaptClaimDetail(updated));
      await refreshList();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-sans flex flex-col">
      <TopNav />
      <main className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1 w-full">
        <div className="lg:col-span-4 flex flex-col gap-6">
          <UploadCard onSubmit={handleSubmit} busy={busy} />
          {error && (
            <div className="text-xs font-mono text-error bg-error/5 border border-error/20 rounded px-3 py-2">
              {error}
            </div>
          )}
          <QueueList claims={claims} selectedId={selectedId} onSelect={setSelectedId} />
        </div>
        <div className="lg:col-span-8 flex flex-col gap-6">
          {selected ? (
            <ClaimDetail claim={selected} onDecision={handleDecision} />
          ) : (
            <div className="bg-white rounded-xl border border-border p-12 text-center text-sm text-muted-foreground">
              {claims.length === 0
                ? "No claims yet. Upload documents on the left to create your first claim."
                : "Select a claim from the queue."}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
