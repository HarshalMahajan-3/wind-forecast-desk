import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, CircleSlash, Loader2, Star } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getVintages } from "@/lib/wind/functions";
import { fmtMW, fmtSignedMW, isoDateTimeUtc, leadTime } from "@/lib/wind/format";
import { cn } from "@/lib/utils";

interface VintagesDialogProps {
  targetTime: string | null;
  cutoffHour: number;
  cutoffMinute: number;
  onOpenChange: (open: boolean) => void;
}

export function VintagesDialog({
  targetTime,
  cutoffHour,
  cutoffMinute,
  onOpenChange,
}: VintagesDialogProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["wind-vintages", targetTime, cutoffHour, cutoffMinute],
    queryFn: () =>
      getVintages({ data: { targetTime: targetTime!, cutoffHour, cutoffMinute } }),
    enabled: targetTime !== null,
  });

  const hh = String(cutoffHour).padStart(2, "0");
  const mm = String(cutoffMinute).padStart(2, "0");

  return (
    <Dialog open={targetTime !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-mono text-base">
            Forecast vintages ·{" "}
            {data ? isoDateTimeUtc(data.targetTime) : targetTime}
          </DialogTitle>
          <DialogDescription>
            Every WINDFOR publication for this interval, checked against the
            decision cutoff — D-1 {hh}:{mm} Europe/London
            {data ? ` (${data.cutoffIso.slice(0, 16).replace("T", " ")} UTC for ${data.settlementDate})` : ""}.
            Vintages published after the cutoff are excluded from the
            decision-time forecast to prevent lookahead bias.
          </DialogDescription>
        </DialogHeader>

        {isLoading || !data ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading publication history…
          </div>
        ) : (
          <div>
            <div className="mb-3 grid grid-cols-3 gap-3 rounded-lg border border-border bg-secondary/40 px-3 py-2.5 text-xs">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Selected forecast
                </div>
                <div className="mt-0.5 font-mono text-chart-forecast">
                  {data.selected
                    ? `${fmtMW(data.selected.generation)} MW`
                    : "None eligible"}
                </div>
                {data.selected ? (
                  <div className="font-mono text-[10px] text-muted-foreground">
                    published {data.selected.publishTime.slice(0, 16).replace("T", " ")} UTC
                  </div>
                ) : null}
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Actual outturn
                </div>
                <div className="mt-0.5 font-mono text-chart-actual">
                  {data.actual === null ? "—" : `${fmtMW(data.actual)} MW`}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Error
                </div>
                <div className="mt-0.5 font-mono text-foreground">
                  {data.selected && data.actual !== null
                    ? `${fmtSignedMW(data.selected.generation - data.actual)} MW`
                    : "—"}
                </div>
              </div>
            </div>

            <div className="max-h-80 overflow-y-auto rounded-lg border border-border">
              <table className="w-full border-collapse text-xs">
                <thead className="sticky top-0 bg-secondary/80">
                  <tr>
                    <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Published (UTC)
                    </th>
                    <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Forecast (MW)
                    </th>
                    <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Lead time
                    </th>
                    <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Eligibility
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.vintages.map((v) => (
                    <tr
                      key={`${v.publishTime}-${v.generation}`}
                      className={cn(
                        "border-t border-border/70",
                        v.selected && "bg-primary/5",
                      )}
                    >
                      <td className="px-3 py-1.5 font-mono text-foreground">
                        {v.publishTime.slice(0, 16).replace("T", " ")}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono text-chart-forecast">
                        {fmtMW(v.generation)}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono text-muted-foreground">
                        {leadTime(v.leadMinutes)}
                      </td>
                      <td className="px-3 py-1.5">
                        {v.selected ? (
                          <Badge className="gap-1 bg-primary/15 text-primary">
                            <Star className="h-3 w-3" />
                            Selected
                          </Badge>
                        ) : v.eligible ? (
                          <Badge
                            variant="outline"
                            className="gap-1 border-status-ok/40 text-status-ok"
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            Eligible
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="gap-1 border-status-missing/40 text-status-missing"
                          >
                            <CircleSlash className="h-3 w-3" />
                            After cutoff — excluded
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                  {data.vintages.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-3 py-6 text-center text-muted-foreground"
                      >
                        No WINDFOR publications found for this interval.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Selection rule: latest eligible publication, ties broken by the
              highest forecast value. {data.vintages.filter((v) => v.eligible).length}{" "}
              of {data.vintages.length} vintages were eligible at the cutoff.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
