import { useCallback, useEffect, useState } from "react";
import { TopNav } from "../components/TopNav";
import { UploadCard } from "../components/UploadCard";
import { QueueList } from "../components/QueueList";
import { ClaimDetail } from "../components/ClaimDetail";
import { Footer } from "../components/Footer";
import { PageLoader } from "../components/pageLoader";
import { api, adaptClaimDetail, adaptClaimSummary } from "../lib/api";
import type { ClaimDecision, ClaimDetailModel, ClaimSummary, ReviewDecisionPayload, UploadPayload } from "../lib/types";

export default function Home() {
  const [claims, setClaims] = useState<ClaimSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<ClaimDetailModel | null>(null);
  const [busy, setBusy] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshList = useCallback(async () => {
    try {
      const list = await api.list();
      const adapted = list.map(adaptClaimSummary);
      setClaims(adapted);
      setSelectedId((cur) => cur || adapted[0]?.id || null);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshList();
  }, [refreshList]);

  useEffect(() => {
    if (!selectedId) {
      setSelected(null);
      return;
    }
    let cancelled = false;
    api
      .get(selectedId)
      .then((c) => {
        if (!cancelled) {
          setSelected(adaptClaimDetail(c));
          setError(null);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  async function handleSubmit({ memberId, files }: UploadPayload): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const created = await api.create({ memberId, files });
      await refreshList();
      setSelectedId(created._id || created.id || null);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleDecision(id: string, decision: ClaimDecision, review: ReviewDecisionPayload = {}): Promise<void> {
    try {
      const updated = await api.decide(id, decision, review);
      setSelected(adaptClaimDetail(updated));
      await refreshList();
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleSaveAdminText(id: string, notes: string, nextSteps: string): Promise<void> {
    try {
      const updated = await api.saveAdminText(id, { notes, nextSteps });
      setSelected(adaptClaimDetail(updated));
      await refreshList();
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-sans flex flex-col">
      {initialLoading && <PageLoader />}
      {busy && !initialLoading && (
        <div className="fixed inset-0 z-50 bg-background/60 backdrop-blur-[2px] flex items-center justify-center">
          <div className="bg-white border border-border rounded-xl shadow-lg px-6 py-5 flex flex-col items-center gap-3">
            <div className="size-9 rounded-full border-2 border-accent border-t-transparent animate-spin" />
            <div className="text-center">
              <p className="text-sm font-bold text-foreground">Processing claim documents</p>
              <p className="text-xs text-muted-foreground mt-1">Render may take a moment to respond.</p>
            </div>
          </div>
        </div>
      )}
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
            <ClaimDetail
              claim={selected}
              onDecision={handleDecision}
              onSaveAdminText={handleSaveAdminText}
            />
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
