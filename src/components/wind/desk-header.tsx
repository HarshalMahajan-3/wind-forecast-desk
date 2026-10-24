import { Database, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";

interface DeskHeaderProps {
  retrievedAt: string;
  datasets: string;
  analysisPeriod: string;
}

export function DeskHeader({
  retrievedAt,
  datasets,
  analysisPeriod,
}: DeskHeaderProps) {
  const retrieved = retrievedAt.slice(0, 16).replace("T", " ");
  return (
    <header className="border-b border-border bg-card/60">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-primary/40 bg-primary/10">
            <Wind className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-foreground">
              Wind Forecast Desk
            </h1>
            <p className="text-xs text-muted-foreground">
              UK day-ahead wind procurement analytics ·{" "}
              <span className="font-mono">{analysisPeriod.split("/")[0]?.slice(0, 10)}</span>{" "}
              –{" "}
              <span className="font-mono">
                {analysisPeriod.split("/")[1]?.slice(0, 10)}
              </span>
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="gap-1.5 border-border font-mono text-[11px]">
            <Database className="h-3 w-3 text-chart-actual" />
            Elexon BMRS · {datasets}
          </Badge>
          <Badge variant="outline" className="gap-1.5 border-border font-mono text-[11px]">
            Snapshot retrieved {retrieved} UTC
          </Badge>
          <Badge
            variant="outline"
            className="gap-1.5 border-status-ok/40 text-status-ok"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-status-ok opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-status-ok" />
            </span>
            <ShieldCheck className="h-3 w-3" />
            Verified
          </Badge>
        </div>
      </div>
    </header>
  );
}

function Wind({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M12 8a3 3 0 0 1 3-3 3 3 0 0 1 3 3c0 1.5-.5 2-2 2H4" />
      <path d="M8 12a2.5 2.5 0 0 1 2.5-2.5A2.5 2.5 0 0 1 13 12c0 1.25-.4 1.5-1.5 1.5H2" />
      <path d="M12 16a2 2 0 0 1 2-2 2 2 0 0 1 2 2c0 1-.3 1-1.5 1H6" />
    </svg>
  );
}
