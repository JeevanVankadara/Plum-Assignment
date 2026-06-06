import { useState, useEffect } from "react";

export function PageLoader() {
  const [dots, setDots] = useState("");

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? "" : prev + "."));
    }, 400);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-6">
        {/* Logo mark */}
        <div className="relative">
          <div className="h-12 w-12 rounded-xl bg-accent flex items-center justify-center shadow-lg shadow-accent/10">
            <span className="font-display text-xl font-bold text-accent-foreground tracking-tight">
              C
            </span>
          </div>
          {/* Orbiting dot */}
          <div className="absolute -inset-1.5 animate-spin" style={{ animationDuration: "2s" }}>
            <div className="h-1.5 w-1.5 rounded-full bg-primary absolute top-0 left-1/2 -translate-x-1/2" />
          </div>
        </div>

        {/* Brand */}
        <div className="text-center">
          <h1 className="font-display text-lg font-bold tracking-tight text-foreground">
            PLUM<span className="font-normal opacity-50">CLAIM</span>
          </h1>
          <p className="mt-1 text-xs text-muted-foreground font-mono tracking-wide">
            Initializing{dots}
          </p>
        </div>

        {/* Progress bar */}
        <div className="w-48 h-1 bg-border rounded-full overflow-hidden">
          <div className="h-full bg-accent rounded-full animate-[loading-bar_1.5s_ease-in-out_infinite]" />
        </div>
      </div>
    </div>
  );
}
