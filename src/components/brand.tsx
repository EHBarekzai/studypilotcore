import { Compass } from "lucide-react";

import { cn } from "@/lib/utils";

export function Brand({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <span className="flex size-8 items-center justify-center rounded-md border border-primary/20 bg-primary text-primary-foreground">
        <Compass className="size-5" />
      </span>
      {!compact ? (
        <span className="font-display text-lg font-semibold">StudyPilot</span>
      ) : null}
    </span>
  );
}
