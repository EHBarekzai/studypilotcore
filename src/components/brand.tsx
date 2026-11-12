import logo from "@/assets/logo.png";

import { cn } from "@/lib/utils";

export function Brand({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <span className="brand-mark size-8">
        <img src={logo} alt="StudyPilot logo" />
      </span>
      {!compact ? (
        <span className="font-display text-lg font-semibold">StudyPilot</span>
      ) : null}
    </span>
  );
}
