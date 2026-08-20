import { Compass } from "lucide-react";

import { cn } from "@/lib/utils";

export function Brand({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-soft">
        <Compass className="size-5" />
      </span>
      {!compact ? (
        <span className="font-display text-lg font-semibold tracking-tight">StudyPilot</span>
      ) : null}
    </span>
  );
}
