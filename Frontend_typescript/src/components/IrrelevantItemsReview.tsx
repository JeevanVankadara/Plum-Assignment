import type { IrrelevantTest } from "../lib/types";

interface IrrelevantItemsReviewProps {
  items: IrrelevantTest[];
  excludedMap: Record<string, boolean>;
  onToggle: (key: string) => void;
  disabled?: boolean;
}

function money(value: number | undefined): string {
  return `₹${(Number(value) || 0).toLocaleString("en-IN")}.00`;
}

export function irrelevantItemKey(item: IrrelevantTest, index: number): string {
  return `${item.testName || "test"}-${item.amount || 0}-${index}`;
}

export function IrrelevantItemsReview({ items, excludedMap, onToggle, disabled = false }: IrrelevantItemsReviewProps) {
  if (!items.length) return null;

  return (
    <div className="mb-5 rounded-lg border border-warning/20 bg-warning/[0.03] p-3">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Irrelevant Items
        </p>
        <span className="text-[10px] font-mono text-warning font-bold">
          Manual Review
        </span>
      </div>
      <div className="space-y-3">
        {items.map((item, index) => {
          const key = irrelevantItemKey(item, index);
          const excluded = excludedMap[key] !== false;
          return (
            <div key={key} className="rounded border border-border bg-white p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-foreground truncate">
                    {item.testName || "Diagnostic test"}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                    {item.reason || "May not align with the diagnosis"}
                  </p>
                </div>
                <span className="font-mono text-xs text-error whitespace-nowrap">
                  -{money(item.amount)}
                </span>
              </div>
              <label className="mt-3 flex items-center justify-between gap-3 text-[11px] font-bold text-foreground">
                <span>Exclude as irrelevant</span>
                <button
                  type="button"
                  onClick={() => !disabled && onToggle(key)}
                  disabled={disabled}
                  className={`relative h-6 w-11 rounded-full border p-0.5 transition-colors duration-200 ${
                    excluded
                      ? "border-warning/40 bg-warning"
                      : "border-border bg-muted-foreground/20"
                  } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
                  aria-pressed={excluded}
                >
                  <span
                    className={`absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow ring-1 ring-black/5 transition-transform duration-200 ${
                      excluded ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </label>
            </div>
          );
        })}
      </div>
    </div>
  );
}
