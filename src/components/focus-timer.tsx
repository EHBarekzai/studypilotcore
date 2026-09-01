import { Pause, Play, RotateCcw, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const PRESETS = [15, 25, 45, 60] as const;

function clock(totalSeconds: number) {
  const s = Math.max(0, Math.round(totalSeconds));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Focus timer with start / pause / resume / finish. Reports the number of
 * minutes actually studied so progress can be recorded.
 */
export function FocusTimer({
  title,
  defaultMinutes,
  onFinish,
  finishing = false,
}: {
  title: string;
  defaultMinutes: number;
  onFinish: (minutesStudied: number) => void;
  finishing?: boolean;
}) {
  const [minutes, setMinutes] = useState(Math.max(5, Math.min(180, defaultMinutes)));
  const [remaining, setRemaining] = useState(minutes * 60);
  const [running, setRunning] = useState(false);
  const [started, setStarted] = useState(false);
  const elapsedRef = useRef(0);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      elapsedRef.current += 1;
      setRemaining((prev) => {
        if (prev <= 1) {
          setRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  function reset(nextMinutes = minutes) {
    setRunning(false);
    setStarted(false);
    elapsedRef.current = 0;
    setMinutes(nextMinutes);
    setRemaining(nextMinutes * 60);
  }

  const progress = minutes * 60 === 0 ? 0 : 1 - remaining / (minutes * 60);
  const studied = Math.max(1, Math.round(elapsedRef.current / 60));

  return (
    <div className="space-y-5">
      <div className="space-y-1 text-center">
        <p className="text-sm text-muted-foreground">Focusing on</p>
        <p className="truncate font-medium">{title}</p>
      </div>

      <div className="relative mx-auto flex size-40 items-center justify-center rounded-full bg-primary-soft">
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: `conic-gradient(var(--color-primary) ${progress * 360}deg, transparent 0deg)`,
            opacity: 0.35,
          }}
          aria-hidden
        />
        <span className="font-display relative text-3xl font-semibold tabular-nums">
          {clock(remaining)}
        </span>
      </div>

      {!started ? (
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Duration</Label>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((preset) => (
              <Button
                key={preset}
                type="button"
                size="sm"
                variant={minutes === preset ? "default" : "outline"}
                onClick={() => reset(preset)}
              >
                {preset}m
              </Button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-center gap-2">
        {running ? (
          <Button type="button" variant="outline" onClick={() => setRunning(false)}>
            <Pause className="size-4" /> Pause
          </Button>
        ) : (
          <Button
            type="button"
            onClick={() => {
              setStarted(true);
              setRunning(true);
            }}
            disabled={remaining === 0}
          >
            <Play className="size-4" /> {started ? "Resume" : "Start"}
          </Button>
        )}
        <Button type="button" variant="ghost" onClick={() => reset()} disabled={!started}>
          <RotateCcw className="size-4" /> Reset
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={!started || finishing}
          onClick={() => onFinish(studied)}
        >
          <Square className="size-4" /> {finishing ? "Saving…" : "Finish"}
        </Button>
      </div>

      {started ? (
        <p className="text-center text-xs text-muted-foreground">
          {studied} minute{studied === 1 ? "" : "s"} studied so far
        </p>
      ) : null}
    </div>
  );
}
