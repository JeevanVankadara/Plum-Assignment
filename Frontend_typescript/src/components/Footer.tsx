import { Link } from "react-router-dom";

export function Footer() {
  return (
    <footer className="border-t border-border bg-white/80 backdrop-blur-md px-6 py-6">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="font-display text-sm tracking-tight font-bold text-accent">
            PLUM<span className="font-normal opacity-50">CLAIMS</span>
          </span>
          <span className="text-xs text-muted-foreground">
            AI-assisted OPD claim adjudication
          </span>
        </div>
        <div className="flex items-center gap-6 text-xs text-muted-foreground">
          <Link to="/" className="hover:text-accent transition-colors">
            Claims Queue
          </Link>
          <Link to="/analytics" className="hover:text-accent transition-colors">
            Analytics
          </Link>
          <Link to="/rules" className="hover:text-accent transition-colors">
            Rules Engine
          </Link>
        </div>
        <div className="text-[10px] text-muted-foreground">
          &copy; {new Date().getFullYear()} PLUMCLAIMS. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
