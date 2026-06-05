import { NavLink } from "react-router-dom";

export function TopNav() {
  const base = "h-14 flex items-center transition-colors hover:text-accent";
  const active = "h-14 flex items-center text-accent border-b-2 border-accent";

  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-border px-6 h-14 flex items-center justify-between font-sans">
      <div className="flex items-center gap-8">
        <span className="font-display text-lg tracking-tight font-bold text-accent">
          PLUM<span className="font-normal opacity-50">CLAIMS</span>
        </span>
        <div className="flex gap-6 text-sm font-medium text-muted-foreground">
          <NavLink to="/" end className={({ isActive }) => (isActive ? active : base)}>
            Claims Queue
          </NavLink>
          <NavLink to="/analytics" className={({ isActive }) => (isActive ? active : base)}>
            Analytics
          </NavLink>
          <NavLink to="/rules" className={({ isActive }) => (isActive ? active : base)}>
            Rules Engine
          </NavLink>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="h-8 w-8 rounded-full bg-accent/5 flex items-center justify-center border border-accent/10">
          <span className="text-[10px] font-bold text-accent">JV</span>
        </div>
      </div>
    </nav>
  );
}
