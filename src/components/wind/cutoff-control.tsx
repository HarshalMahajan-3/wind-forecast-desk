import { RotateCcw, Timer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cutoffUtcIso } from "@/lib/wind/time";

interface CutoffControlProps {
  cutoffHour: number;
  cutoffMinute: number;
  onChange: (hour: number, minute: number) => void;
}

const PRESETS: { label: string; hour: number; minute: number }[] = [
  { label: "06:00", hour: 6, minute: 0 },
  { label: "10:00", hour: 10, minute: 0 },
  { label: "11:00", hour: 11, minute: 0 },
  { label: "14:00", hour: 14, minute: 0 },
];

export function CutoffControl({
  cutoffHour,
  cutoffMinute,
  onChange,
}: CutoffControlProps) {
  const hh = String(cutoffHour).padStart(2, "0");
  const mm = String(cutoffMinute).padStart(2, "0");
  // Illustrative UTC conversion for a mid-January delivery day (GMT = UTC+0).
  const sampleUtc = cutoffUtcIso("2026-01-15", cutoffHour, cutoffMinute);
  const isDefault = cutoffHour === 10 && cutoffMinute === 0;

  return (
    <div className="flex flex-wrap items-end gap-x-5 gap-y-3 rounded-lg border border-border bg-card px-4 py-3">
      <div className="flex items-center gap-2 self-center">
        <Timer className="h-4 w-4 text-primary" />
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Decision cutoff
          </div>
          <div className="text-sm text-foreground">
            D-1 ·{" "}
            <span className="font-mono text-primary">
              {hh}:{mm}
            </span>{" "}
            Europe/London
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <label className="sr-only" htmlFor="cutoff-hour">
          Cutoff hour
        </label>
        <Input
          id="cutoff-hour"
          type="number"
          min={0}
          max={23}
          value={cutoffHour}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (Number.isInteger(v) && v >= 0 && v <= 23)
              onChange(v, cutoffMinute);
          }}
          className="h-9 w-16 bg-background text-center font-mono"
        />
        <span className="font-mono text-muted-foreground">:</span>
        <label className="sr-only" htmlFor="cutoff-minute">
          Cutoff minute
        </label>
        <Input
          id="cutoff-minute"
          type="number"
          min={0}
          max={59}
          step={5}
          value={cutoffMinute}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (Number.isInteger(v) && v >= 0 && v <= 59)
              onChange(cutoffHour, v);
          }}
          className="h-9 w-16 bg-background text-center font-mono"
        />
      </div>

      <div className="flex items-center gap-1.5">
        {PRESETS.map((p) => {
          const active = p.hour === cutoffHour && p.minute === cutoffMinute;
          return (
            <Button
              key={p.label}
              size="sm"
              variant={active ? "secondary" : "ghost"}
              className={
                "h-8 px-2.5 font-mono text-xs " +
                (active ? "border border-primary/50 text-primary" : "")
              }
              onClick={() => onChange(p.hour, p.minute)}
            >
              {p.label}
            </Button>
          );
        })}
      </div>

      <div className="ml-auto flex items-center gap-3">
        <span className="hidden text-[11px] text-muted-foreground lg:block">
          e.g. delivery 15 Jan → cutoff{" "}
          <span className="font-mono text-foreground">
            {sampleUtc.slice(0, 16).replace("T", " ")} UTC
          </span>{" "}
          (GMT in January)
        </span>
        <Button
          size="sm"
          variant="outline"
          disabled={isDefault}
          className="h-8 gap-1.5 text-xs"
          onClick={() => onChange(10, 0)}
        >
          <RotateCcw className="h-3 w-3" />
          Default
        </Button>
      </div>
    </div>
  );
}
