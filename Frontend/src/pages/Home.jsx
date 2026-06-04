import { useState } from "react";
import { TopNav } from "../components/TopNav.jsx";
import { UploadCard } from "../components/UploadCard.jsx";
import { QueueList } from "../components/QueueList.jsx";
import { ClaimDetail } from "../components/ClaimDetail.jsx";
import { mockClaims } from "../data/mockClaims.js";

export default function Home() {
  const [claims, setClaims] = useState(mockClaims);
  const [selectedId, setSelectedId] = useState(mockClaims[0].id);
  const selected = claims.find((c) => c.id === selectedId) ?? claims[0];

  function handleDecision(id, decision) {
    setClaims((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              status: decision === "Approved" ? "Auto-Approved" : "Rejected",
              approved: decision === "Approved" ? c.approved : 0,
            }
          : c
      )
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <TopNav />
      <main className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 flex flex-col gap-6">
          <UploadCard />
          <QueueList claims={claims} selectedId={selectedId} onSelect={setSelectedId} />
        </div>
        <div className="lg:col-span-8 flex flex-col gap-6">
          <ClaimDetail claim={selected} onDecision={handleDecision} />
        </div>
      </main>
    </div>
  );
}
