function statusBadge(status) {
  if (status === "APPROVED")
    return "bg-success/10 text-success ring-success/20";
  if (status === "REJECTED") return "bg-error/10 text-error ring-error/20";
  return "bg-warning/10 text-warning ring-warning/20";
}

function confidenceColor(c) {
  if (c >= 90) return "bg-success";
  if (c >= 70) return "bg-warning";
  return "bg-error";
}

export function ClaimDetail({ claim, onDecision }) {
  return (
    <div className="bg-white rounded-xl border border-border overflow-hidden shadow-md font-sans">
      <div className="p-6 border-b border-border flex justify-between items-start bg-white">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-xl font-display font-bold text-foreground">
              Claim #{claim.claimNo || claim.id}
            </h1>
            <span
              className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ring-1 ${statusBadge(
                claim.status
              )}`}
            >
              {claim.status}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Patient: <span className="text-foreground font-medium">{claim.patient}</span>{" "}
            • ID: <span className="font-mono">{claim.memberId}</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">
            Confidence Score
          </p>
          <div className="flex items-center gap-2">
            <div className="w-24 h-1.5 bg-border rounded-full overflow-hidden">
              <div
                className={`h-full ${confidenceColor(claim.confidence)}`}
                style={{ width: `${claim.confidence}%` }}
              ></div>
            </div>
            <span className="text-xs font-mono font-bold text-foreground">
              {claim.confidence}%
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 min-h-[500px]">
        <div className="bg-background p-6 border-r border-border">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-4">
            Extracted Context
          </h3>
          <div className="w-full aspect-[3/4] bg-white border border-border shadow-sm rounded relative overflow-hidden">
            <div className="absolute top-6 left-6 right-6 h-10 border-b border-dashed border-border flex items-center justify-between">
              <span className="font-display font-bold text-sm text-accent">
                {claim.provider.split(",")[0]}
              </span>
              <span className="text-[9px] text-muted-foreground font-mono">
                {claim.serviceDate}
              </span>
            </div>
            <div className="absolute top-20 left-6 right-6 space-y-2">
              <div className="h-2 w-2/3 bg-foreground/10 rounded"></div>
              <div className="h-2 w-1/2 bg-foreground/10 rounded"></div>
            </div>
            <div className="absolute top-[36%] left-6 right-6 h-8 border-2 border-warning/50 bg-warning/5 rounded flex items-center px-2">
              <span className="text-[9px] font-mono text-warning font-bold">
                Rx: highlighted line
              </span>
            </div>
            <div className="absolute top-[52%] left-10 w-1/2 h-6 border-2 border-success/50 bg-success/5 rounded flex items-center px-2">
              <span className="text-[9px] font-mono text-success font-bold">
                Doctor stamp
              </span>
            </div>
            <div className="absolute bottom-4 right-4 text-[9px] font-mono text-muted-foreground">
              Reg: {claim.docRegNo}
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground mt-3 leading-relaxed">
            <span className="font-mono font-semibold text-foreground">
              {claim.doctor}
            </span>{" "}
            • {claim.department}. Source document extracted via OCR pipeline.
          </p>
        </div>

        <div className="p-6 flex flex-col">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-4">
            Adjudication Trail
          </h3>
          <div className="space-y-5 max-h-[420px] overflow-y-auto pr-2">
            {claim.rules.map((r) => {
              const isPass = r.state === "pass";
              const isWarn = r.state === "warn";
              const dotBg = isPass ? "bg-success" : isWarn ? "bg-warning" : "bg-error";
              const ring = isPass
                ? ""
                : isWarn
                ? "ring-4 ring-warning/10"
                : "ring-4 ring-error/10";
              const wrap =
                isPass
                  ? ""
                  : isWarn
                  ? "border border-warning/20 bg-warning/[0.03] p-3 rounded-lg"
                  : "border border-error/20 bg-error/[0.03] p-3 rounded-lg";
              return (
                <div key={r.id} className="flex gap-4">
                  <div
                    className={`mt-1 size-5 rounded-full ${dotBg} ${ring} flex items-center justify-center shrink-0`}
                  >
                    <span className="text-white text-[10px] font-bold">
                      {isPass ? "✓" : isWarn ? "!" : "✕"}
                    </span>
                  </div>
                  <div className={`flex-1 ${wrap}`}>
                    <div className="flex justify-between">
                      <p className="text-xs font-bold text-foreground">{r.label}</p>
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {r.id}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                      {r.detail}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-8 pt-6 border-t border-border">
            <div className="flex justify-between py-1 text-xs">
              <span className="text-muted-foreground">Claimed Amount</span>
              <span className="font-mono text-foreground">
                ₹{claim.claimed.toLocaleString("en-IN")}.00
              </span>
            </div>
            <div className="flex justify-between py-1 text-xs">
              <span className="text-muted-foreground">System Deductions</span>
              <span className="font-mono text-error">
                -₹{claim.deductions.toLocaleString("en-IN")}.00
              </span>
            </div>
            <div className="flex justify-between py-1 text-xs">
              <span className="text-muted-foreground">Copay</span>
              <span className="font-mono text-error">
                -₹{claim.copay.toLocaleString("en-IN")}.00
              </span>
            </div>
            <div className="flex justify-between pt-4 mt-2 border-t border-border">
              <span className="font-bold text-sm uppercase text-foreground">
                Approved Amount
              </span>
              <span className="font-mono font-bold text-lg text-success">
                ₹{claim.approved.toLocaleString("en-IN")}.00
              </span>
            </div>
          </div>

          <div className="flex gap-2 mt-6">
            <button
              onClick={() => onDecision(claim.id, "Rejected")}
              className="flex-1 bg-white border border-border py-2 rounded text-xs font-bold text-foreground hover:bg-background transition-colors"
            >
              Reject Claim
            </button>
            <button
              onClick={() => onDecision(claim.id, "Approved")}
              className="flex-1 bg-accent text-accent-foreground py-2 rounded text-xs font-bold hover:bg-accent/90 transition-all shadow-lg shadow-accent/10"
            >
              Approve Final
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
