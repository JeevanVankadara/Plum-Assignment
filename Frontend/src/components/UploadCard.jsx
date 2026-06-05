import { useRef, useState } from "react";

export function UploadCard({ onSubmit, busy }) {
  const [memberId, setMemberId] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [files, setFiles] = useState([]);
  const inputRef = useRef(null);

  function addFiles(list) {
    if (busy || !list?.length) return;
    setFiles((prev) => [...prev, ...Array.from(list)]);
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    addFiles(e.dataTransfer.files);
  }

  function handlePick(e) {
    addFiles(e.target.files);
    e.target.value = "";
  }

  async function submit() {
    if (busy) return;
    if (!files.length) {
      inputRef.current?.click();
      return;
    }

    await onSubmit?.({ memberId, files });
    setFiles([]);
    setMemberId("");
  }

  return (
    <section className="bg-white rounded-xl border border-border p-5 shadow-sm font-sans">
      <h2 className="font-display text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">
        New Adjudication
      </h2>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!busy) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !busy && inputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center text-center transition-colors group ${
          busy ? "opacity-60 cursor-not-allowed" : "cursor-pointer"
        } ${dragOver ? "border-accent/40 bg-accent/5" : "border-border hover:border-accent/20"}`}
      >
        <input
          ref={inputRef}
          id="claim-file-input"
          type="file"
          multiple
          accept="application/pdf,image/png,image/jpeg"
          className="hidden"
          onChange={handlePick}
          disabled={busy}
        />
        <div className="size-10 bg-accent/5 rounded-full flex items-center justify-center mb-3 group-hover:bg-accent/10 transition-colors">
          <div className="size-4 border-2 border-accent border-t-transparent rounded-full animate-spin [animation-duration:2s]" />
        </div>
        <p className="text-sm font-medium text-foreground">Drop or click to add claim documents</p>
        <p className="text-xs text-muted-foreground mt-1">Prescription, Bills, Lab Reports (PDF/JPG)</p>
      </div>

      {files.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="text-xs font-mono text-muted-foreground flex justify-between bg-background border border-border rounded px-2 py-1">
              <span className="truncate">{f.name}</span>
              <span className="text-success">queued</span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 space-y-3">
        <div className="relative">
          <label className="text-[10px] font-bold uppercase text-muted-foreground absolute left-3 top-2">
            Member ID
          </label>
          <input
            type="text"
            value={memberId}
            onChange={(e) => setMemberId(e.target.value)}
            placeholder="MEM-9923485"
            disabled={busy}
            className="w-full pt-6 pb-2 px-3 bg-background border border-border rounded-md text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:opacity-60"
          />
        </div>
        <button
          onClick={submit}
          disabled={busy}
          className="w-full bg-accent text-accent-foreground py-2.5 rounded-md text-sm font-semibold hover:bg-accent/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy ? "Processing..." : files.length ? "Process Claim" : "Choose Files"}
        </button>
      </div>
    </section>
  );
}
